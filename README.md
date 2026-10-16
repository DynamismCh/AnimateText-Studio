# AnimateText Studio

Children's animated-series creator built with React, TypeScript, Vite, and Tailwind CSS.

## Video generation model

AnimateText Studio is being migrated to **Wan2.1 VACE 1.3B** for reference-to-video generation. Upload a character image, describe the action, and the GPU backend returns a downloadable MP4.

- Official model code: https://github.com/Wan-Video/Wan2.1
- Official VACE project: https://github.com/ali-vilab/VACE
- Model checkpoint: https://huggingface.co/Wan-AI/Wan2.1-VACE-1.3B
- Adapter in this repository: [backend/wan21-vace](backend/wan21-vace/README.md)

The official Wan2.1 repository lists VACE-1.3B for 480P reference-to-video. The project's documented 8.19 GB figure applies to the separate T2V-1.3B model, not necessarily VACE. **The VACE model has not yet been confirmed to fit within 11 GB VRAM.** Test one short clip on Kaggle and monitor peak GPU memory before relying on it.

## Kaggle GPU backend

The React app runs separately from model inference. The model code and weights should be downloaded into the Kaggle runtime, not committed to this GitHub repository.

1. Enable a Kaggle GPU notebook.
2. Clone this repository and the official Wan2.1 repository into the notebook's working directory.
3. Install the official Wan2.1 dependencies and `backend/wan21-vace/requirements.txt`.
4. Download `Wan-AI/Wan2.1-VACE-1.3B` into `/kaggle/working/Wan2.1-VACE-1.3B`.
5. Start the adapter from `backend/wan21-vace/server.py` with `WAN21_REPO_DIR` and `WAN21_CKPT_DIR` set.
6. Verify `/api/health`, then test a 17-frame clip and check GPU memory usage.
7. Once the test succeeds, expose the API securely and set `VITE_WAN21_API_URL` to its public HTTPS URL.

See the [Wan2.1 VACE adapter guide](backend/wan21-vace/README.md) for the API contract and setup details. The Kaggle session must remain active during generation. A public tunnel URL is temporary and should not be treated as a permanent production service.

## Frontend setup

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_WAN21_API_URL` to the running GPU backend URL. If it is blank, the app will tell you that the model service is not connected yet. Do not add secrets to frontend environment variables or commit private character images.

## Other features

- Upload and select character images.
- Generate a short reference-to-video clip with Wan2.1 VACE.
- Preview and download generated video.
- Browser voice synthesis, music and sound effects through Audio Workshop.
- Lightweight local 2D scene workflow and WebM export.
- Studio assistant endpoint and downloadable diagnostics.

## Limitations

- Wan2.1 VACE integration is prepared but has **not yet been verified end-to-end on Kaggle**.
- The first GPU test must establish whether the VACE 1.3B model fits the target VRAM budget.
- The local storyboard/2D scene workflow is not the same as diffusion-based AI video.
- Model generation can be slow; keep the GPU runtime active and start with short clips.
- Do not commit model weights, tokens, tunnel credentials, or private character images.

## License and attribution

This repository contains AnimateText Studio code and a small adapter for the official Wan2.1 inference code. The Wan2.1 source and VACE model weights are installed separately from their official sources and are not copied into this repository. Review the upstream source and model licenses before use or redistribution.
