from __future__ import annotations

import os
import tempfile
import uuid
from pathlib import Path

import gradio as gr
import spaces
from PIL import Image

from ltx_video.inference import InferenceConfig, infer

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "ltxv-2b-lite.yaml"
OUTPUTS = Path(tempfile.gettempdir()) / "animatetext-ltx-outputs"
OUTPUTS.mkdir(parents=True, exist_ok=True)

# Keep these intentionally small for the free ZeroGPU trial.
WIDTH = 384
HEIGHT = 256
FRAMES = 17
FPS = 8


@spaces.GPU(duration=180)
def generate_video(prompt: str, character_image, seed: int, progress=gr.Progress()):
    prompt = (prompt or "").strip()
    if len(prompt) < 3:
        raise gr.Error("Please describe what Sunny, Bloop, or the scene should do.")
    if len(prompt) > 1200:
        raise gr.Error("Please keep the scene prompt under 1,200 characters.")

    conditioning_path = None
    if character_image is not None:
        try:
            image = character_image.convert("RGB")
            conditioning_path = OUTPUTS / f"character-{uuid.uuid4().hex}.png"
            image.save(conditioning_path, format="PNG")
        except Exception as exc:
            raise gr.Error(f"Could not read that character image: {exc}") from exc

    progress(0.05, desc="Preparing a short LTX clip…")
    before = {p.resolve() for p in OUTPUTS.glob("*.mp4")}
    try:
        config = InferenceConfig(
            prompt=prompt,
            output_path=str(OUTPUTS),
            pipeline_config=str(CONFIG),
            seed=int(seed),
            width=WIDTH,
            height=HEIGHT,
            num_frames=FRAMES,
            frame_rate=FPS,
            offload_to_cpu=True,
            conditioning_media_paths=[str(conditioning_path)] if conditioning_path else None,
            conditioning_start_frames=[0] if conditioning_path else None,
        )
        progress(0.1, desc="Loading the LTX model and generating video…")
        infer(config)
        created = [p for p in OUTPUTS.glob("*.mp4") if p.resolve() not in before]
        if not created:
            raise gr.Error("LTX did not return an MP4. Try again later or check the Space logs.")
        newest = max(created, key=lambda p: p.stat().st_mtime)
        progress(1.0, desc="Your video is ready.")
        return str(newest), f"Generated {FRAMES} frames at {FPS} FPS ({WIDTH}×{HEIGHT})."
    except gr.Error:
        raise
    except Exception as exc:
        raise gr.Error(
            "LTX generation failed. The free GPU allowance may be exhausted, the Space may have timed out, "
            f"or a model dependency failed. Details: {str(exc)[:350]}"
        ) from exc
    finally:
        if conditioning_path:
            conditioning_path.unlink(missing_ok=True)


with gr.Blocks(title="AnimateText Studio — LTX Lite") as demo:
    gr.Markdown(
        "# 🎬 AnimateText Studio — LTX Lite\n"
        "Generate a short real AI video clip. Add a character image for image-to-video, "
        "or leave it empty for text-to-video. Free GPU use is limited."
    )
    with gr.Row():
        with gr.Column():
            prompt = gr.Textbox(
                label="Scene prompt",
                placeholder="Sunny runs through a meadow, stops beside Bloop, smiles and waves. Keep the character design consistent.",
                lines=4,
                max_lines=6,
            )
            character = gr.Image(label="Optional character image", type="pil")
            seed = gr.Number(label="Seed", value=171198, precision=0)
            run = gr.Button("Generate short AI video", variant="primary")
        with gr.Column():
            output = gr.Video(label="Generated MP4", autoplay=False)
            message = gr.Textbox(label="Status", interactive=False)
    gr.Markdown(
        "**Preview limits:** 384×256, 17 frames, 8 FPS. This is a technical test, not full episode rendering. "
        "Model loading may take time and the free daily GPU allowance may be used by one attempt."
    )
    run.click(generate_video, inputs=[prompt, character, seed], outputs=[output, message], api_name="generate")

demo.queue(default_concurrency_limit=1).launch()
