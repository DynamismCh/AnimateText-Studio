"""HTTP adapter for the official Wan2.1 VACE 1.3B CLI.

The official model code and checkpoints are installed separately in the GPU runtime.
Do not commit model weights to this repository.
"""
from __future__ import annotations

import asyncio
import base64
import binascii
import os
import subprocess
import sys
import threading
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ConfigDict
from PIL import Image, UnidentifiedImageError
from io import BytesIO

ROOT = Path(__file__).resolve().parent
WAN_REPO = Path(os.environ.get("WAN21_REPO_DIR", "/kaggle/working/Wan2.1")).resolve()
CHECKPOINT = Path(os.environ.get("WAN21_CKPT_DIR", "/kaggle/working/Wan2.1-VACE-1.3B")).resolve()
OUTPUTS = Path(os.environ.get("WAN21_OUTPUT_DIR", str(ROOT / "outputs"))).resolve()
UPLOADS = Path(os.environ.get("WAN21_UPLOAD_DIR", str(ROOT / "uploads"))).resolve()
OUTPUTS.mkdir(parents=True, exist_ok=True)
UPLOADS.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="AnimateText Studio — Wan2.1 VACE", version="0.1.0")
origins = [item.strip() for item in os.environ.get("WAN21_ALLOWED_ORIGINS", "*").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS)), name="outputs")
generation_lock = threading.Lock()


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prompt: str = Field(min_length=3, max_length=1200)
    image_base64: str = Field(min_length=20, max_length=10_000_000)
    image_mime_type: str | None = Field(default=None, max_length=40)
    width: int = Field(default=832, ge=256, le=832)
    height: int = Field(default=480, ge=256, le=480)
    frames: int = Field(default=17, ge=9, le=33)
    fps: int = Field(default=8, ge=4, le=16)
    seed: int = Field(default=-1, ge=-1, le=2_147_483_647)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "service": "wan21-vace-1.3B",
        "wan_repo_exists": (WAN_REPO / "generate.py").is_file(),
        "checkpoint_exists": CHECKPOINT.is_dir(),
        "note": "Health does not prove the model fits in GPU memory; run the short test generation first.",
    }


def run_generation(request: GenerateRequest, image_path: Path, output_path: Path) -> None:
    if not (WAN_REPO / "generate.py").is_file():
        raise RuntimeError(f"Wan2.1 code was not found at {WAN_REPO}")
    if not CHECKPOINT.is_dir():
        raise RuntimeError(f"Wan2.1-VACE-1.3B checkpoint folder was not found at {CHECKPOINT}")

    # Wan2.1 requires frame counts of 4n+1. The UI defaults to 17 frames for a short test.
    frame_num = request.frames
    if (frame_num - 1) % 4:
        frame_num = max(9, ((frame_num - 1) // 4) * 4 + 1)

    command = [
        sys.executable, str(WAN_REPO / "generate.py"),
        "--task", "vace-1.3B",
        "--size", "832*480",
        "--frame_num", str(frame_num),
        "--ckpt_dir", str(CHECKPOINT),
        "--offload_model", "True",
        "--t5_cpu",
        "--sample_steps", "12",
        "--src_ref_images", str(image_path),
        "--prompt", request.prompt.strip(),
        "--save_file", str(output_path),
        "--base_seed", str(request.seed),
    ]
    completed = subprocess.run(
        command,
        cwd=str(WAN_REPO),
        capture_output=True,
        text=True,
        timeout=int(os.environ.get("WAN21_GENERATION_TIMEOUT", "1800")),
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "Wan2.1 generation failed")[-3500:]
        raise RuntimeError(detail)
    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise RuntimeError("Wan2.1 exited without creating a video file.")


@app.post("/api/generate")
async def generate(request: GenerateRequest):
    try:
        raw = base64.b64decode(request.image_base64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Character image must be valid base64.")
    if len(raw) > 7 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Use a character image smaller than 7 MB.")

    image_path = UPLOADS / f"{uuid.uuid4().hex}.png"
    output_path = OUTPUTS / f"wan21-vace-{uuid.uuid4().hex}.mp4"
    try:
        try:
            with Image.open(BytesIO(raw)) as image:
                image.convert("RGB").save(image_path, format="PNG")
        except (UnidentifiedImageError, OSError):
            raise HTTPException(status_code=400, detail="Upload a valid PNG, JPEG or WebP character image.")

        await asyncio.to_thread(generation_lock.acquire)
        try:
            await asyncio.to_thread(run_generation, request, image_path, output_path)
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="Generation timed out. Try a shorter prompt or restart the Kaggle GPU session.")
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=f"Wan2.1 VACE generation failed: {str(exc)[:3500]}") from exc
        finally:
            generation_lock.release()

        return {
            "ok": True,
            "mode": "reference-to-video",
            "video_url": f"/outputs/{output_path.name}",
            "frames": request.frames,
            "fps": request.fps,
        }
    finally:
        image_path.unlink(missing_ok=True)
