# Wan2.1 VACE 1.3B — AnimateText Studio GPU adapter

This adapter connects the existing AnimateText Studio character-upload screen to the official [Wan2.1](https://github.com/Wan-Video/Wan2.1) VACE 1.3B reference-to-video pipeline. It sends the uploaded character image and motion prompt to the GPU host, then returns an MP4 URL.

**Important:** this integration is prepared for Kaggle testing, not yet verified end-to-end. Wan2.1 VACE 1.3B is the selected candidate, but the official project does not promise that VACE inference will stay below 11 GB VRAM. Measure peak GPU memory during the first generation. The 1.3B model is documented for 480P; the official Wan project documents 8.19 GB for the separate T2V-1.3B model, which is not the same as VACE. See the [official Wan2.1 README](https://github.com/Wan-Video/Wan2.1) and [VACE model card](https://huggingface.co/Wan-AI/Wan2.1-VACE-1.3B).

## Keep the repository small

Do not commit model checkpoint files. They are large; download them into Kaggle's temporary working storage. The official Wan2.1 source is cloned into the Kaggle runtime, while this adapter stays in AnimateText Studio.

## Kaggle setup outline

1. Enable a GPU accelerator in the Kaggle notebook.
2. Clone this repository and the official Wan2.1 repository into `/kaggle/working`.
3. Install the official Wan2.1 requirements and this adapter's requirements.
4. Download `Wan-AI/Wan2.1-VACE-1.3B` into `/kaggle/working/Wan2.1-VACE-1.3B`.
5. Set `WAN21_REPO_DIR=/kaggle/working/Wan2.1` and `WAN21_CKPT_DIR=/kaggle/working/Wan2.1-VACE-1.3B`.
6. Run the health check at `/api/health`, then test one 17-frame clip while monitoring `torch.cuda.max_memory_allocated()` and `nvidia-smi`.
7. Only after the test succeeds, expose the API through a secure tunnel and set `VITE_WAN21_API_URL` in the frontend environment.

The Kaggle runtime must remain active while a request is generating. Do not put a tunnel token or other secret in this repository. The adapter's permissive CORS default is for initial testing only; set `WAN21_ALLOWED_ORIGINS` to the actual frontend origin before using it beyond a private test.

## API contract

- `GET /api/health`
- `POST /api/generate` with JSON fields `prompt`, `image_base64`, optional `image_mime_type`, `frames`, `fps`, `width`, `height`, and `seed`.
- A successful response includes `video_url`, served from `/outputs/`.

The current app uses the selected character as a reference image and asks for a short 17-frame clip. Longer scenes and multi-character continuity should be added only after this minimal path passes a real GPU test.

## License and attribution

Wan2.1 VACE 1.3B is listed as Apache-2.0 in the official VACE project. This repository contains only our adapter and setup notes, not the upstream Wan2.1 source or model weights. Follow the official [Wan2.1 repository](https://github.com/Wan-Video/Wan2.1), [VACE project](https://github.com/ali-vilab/VACE), and model-card terms when installing, using, or redistributing those components.
