"""Small HTTP adapter around the official LTX-Video inference package.

This file is our integration layer; model inference remains in the upstream
Lightricks/LTX-Video project. Do not run this on a CPU-only 4 GB laptop.
"""
from __future__ import annotations

import asyncio
import base64
import binascii
import os
import threading
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ConfigDict
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent
OUTPUTS = Path(os.environ.get("LTX_OUTPUT_DIR", str(ROOT / "outputs"))).resolve()
UPLOADS = Path(os.environ.get("LTX_UPLOAD_DIR", str(ROOT / "uploads"))).resolve()
CONFIG = Path(os.environ.get("LTX_PIPELINE_CONFIG", str(ROOT / "ltxv-2b-lite.yaml"))).resolve()
OUTPUTS.mkdir(parents=True, exist_ok=True)
UPLOADS.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="AnimateText Studio — LTX Lite", version="0.1.0")
allowed_origins = [item.strip() for item in os.environ.get("LTX_ALLOWED_ORIGINS", "*").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS)), name="outputs")
generation_lock = threading.Lock()


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prompt: str = Field(min_length=3, max_length=1200)
    # Send the image bytes as base64 without a data: URL prefix. Omit for text-to-video.
    image_base64: Optional[str] = Field(default=None, max_length=10_000_000)
    image_mime_type: Optional[str] = Field(default=None, max_length=40)
    width: int = Field(default=384, ge=256, le=512)
    height: int = Field(default=256, ge=256, le=512)
    frames: int = Field(default=17, ge=9, le=33)
    fps: int = Field(default=8, ge=4, le=16)
    seed: int = Field(default=171198, ge=0, le=2_147_483_647)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "service": "ltx-video-lite",
        "config_exists": CONFIG.is_file(),
        "cuda_note": "Generation requires a supported GPU; health status does not prove model weights are loaded.",
    }


@app.post("/api/generate")
async def generate(request: GenerateRequest):
    if not CONFIG.is_file():
        raise HTTPException(status_code=500, detail="LTX pipeline config is missing.")
    image_path = None
    if request.image_base64:
        try:
            raw = base64.b64decode(request.image_base64, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(status_code=400, detail="Character image must be valid base64.")
        if len(raw) > 7 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Please use a character image smaller than 7 MB.")
        image_path = UPLOADS / f"{uuid.uuid4().hex}.png"
        try:
            from io import BytesIO
            with Image.open(BytesIO(raw)) as image:
                image.convert("RGB").save(image_path, format="PNG")
        except (UnidentifiedImageError, OSError):
            raise HTTPException(status_code=400, detail="Please upload a valid PNG, JPEG or WebP character image.")

    # Avoid overlapping model loads/generation requests on a small GPU.
    await asyncio.to_thread(generation_lock.acquire)
    try:
        try:
            import torch
            from ltx_video.inference import InferenceConfig, infer
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"LTX inference dependencies are not installed: {exc}") from exc

        if not torch.cuda.is_available() and not torch.backends.mps.is_available():
            raise HTTPException(
                status_code=503,
                detail="No supported GPU was detected. This model is not practical on a CPU-only low-memory computer.",
            )

        config = InferenceConfig(
            prompt=request.prompt.strip(),
            output_path=str(OUTPUTS),
            pipeline_config=str(CONFIG),
            seed=request.seed,
            width=request.width,
            height=request.height,
            num_frames=request.frames,
            frame_rate=request.fps,
            offload_to_cpu=True,
            conditioning_media_paths=[str(image_path)] if image_path else None,
            conditioning_start_frames=[0] if image_path else None,
        )
        before = {p.resolve() for p in OUTPUTS.glob("*.mp4")}
        try:
            await asyncio.to_thread(infer, config)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"LTX generation failed: {str(exc)[:500]}") from exc
        created = [p for p in OUTPUTS.glob("*.mp4") if p.resolve() not in before]
        if not created:
            raise HTTPException(status_code=500, detail="LTX finished without producing an MP4 file.")
        newest = max(created, key=lambda p: p.stat().st_mtime)
        return {
            "ok": True,
            "mode": "image-to-video" if image_path else "text-to-video",
            "video_url": f"/outputs/{newest.name}",
            "width": request.width,
            "height": request.height,
            "frames": request.frames,
            "fps": request.fps,
        }
    finally:
        generation_lock.release()
        if image_path:
            image_path.unlink(missing_ok=True)
