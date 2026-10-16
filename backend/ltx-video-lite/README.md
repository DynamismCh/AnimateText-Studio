# LTX Video Lite adapter for AnimateText Studio

This folder contains a small API adapter and a low-resolution configuration for the official [Lightricks/LTX-Video](https://github.com/Lightricks/LTX-Video) inference package. It is **not** a copy of the entire upstream source tree: the upstream package is installed from its official Git repository so upstream attribution and license files remain intact.

## What it supports

- Text-to-video when no character image is supplied.
- Image-to-video when a character image is supplied.
- Short preview clips by default: 384×256, 17 frames, 8 FPS.
- One generation at a time to reduce GPU memory pressure.
- Returns an MP4 URL that the AnimateText Studio frontend can preview and download.

## Important hardware limits

This keeps the *web app* small, not the AI model small enough for every computer. The LTX 2B distilled weights, text encoder and optional spatial upscaler are downloaded separately and require substantial disk space and GPU memory. The default 2B configuration uses bfloat16; use a compatible CUDA GPU. A CPU-only 4 GB Celeron laptop is not a realistic inference host. Lower resolution and fewer frames reduce compute but do not eliminate the GPU requirement.

The first request can be slow because model files must be downloaded. GPU hosting may have queues, time limits or costs; this adapter does not create free GPU capacity by itself.

## Install on a GPU machine

Use Python 3.10+ and a compatible PyTorch/CUDA installation for the machine. From this folder:

```bash
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows PowerShell:
# .venv\\Scripts\\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 7860
```

Open `http://localhost:7860/api/health`. The health endpoint only checks the service/config; it does not guarantee that model loading or generation will succeed.

## API

`POST /api/generate` with JSON:

```json
{
  "prompt": "Sunny walks into a sunny meadow, turns to Bloop and waves. Keep the character design consistent.",
  "image_base64": "OPTIONAL_BASE64_IMAGE_BYTES",
  "image_mime_type": "image/png",
  "width": 384,
  "height": 256,
  "frames": 17,
  "fps": 8,
  "seed": 171198
}
```

Omit `image_base64` for text-to-video. Include it for image-to-video. A successful response contains `video_url`; if the frontend is hosted on another domain, prefix this path with the LTX service origin. Configure `LTX_ALLOWED_ORIGINS` to the exact frontend origin before exposing this service publicly.

## License and attribution

- Adapter code in this folder is newly written for AnimateText Studio.
- LTX-Video source code is licensed under Apache-2.0; consult the upstream license for attribution and redistribution requirements: https://github.com/Lightricks/LTX-Video/blob/main/LICENSE
- Model weights have separate terms from the source-code license. Review the model card and applicable weight license before downloading or redistributing weights: https://huggingface.co/Lightricks/LTX-Video
- Do not upload model weights or character images to this Git repository.
