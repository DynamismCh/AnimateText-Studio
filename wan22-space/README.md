# Wan 2.2 Fast integration workspace

This folder is a separate workspace for adapting the public **Wan 2.2 Fast image-to-video Space** to AnimateText Studio without mixing its Python/GPU runtime into the React/Vite frontend.

Upstream source:
- Space: https://huggingface.co/spaces/zerogpu-aoti/wan2-2-fp8da-aoti-faster
- Official Wan model code: https://github.com/Wan-Video/Wan2.2

## What this does

The GitHub Actions workflow `.github/workflows/sync-wan22-space.yml` mirrors the Space's public Python app and helper files into `wan22-space/upstream/`. It runs when this workflow or this README is first pushed, and can also be started manually from the repository's Actions tab.

The source mirror is deliberately kept separate from the main app. It is a starting point for deployment and integration, not a claim that GPU video generation already runs inside Vercel.

## Important deployment notes

1. The fast demo is **image-to-video**, so AnimateText Studio must provide a character image plus a movement prompt. It is not a pure text-to-video model.
2. The fast demo depends on Hugging Face ZeroGPU-specific APIs and compilation/quantization helpers. Copying files to GitHub does not provide a GPU or automatically create a working Space.
3. Your 4 GB Celeron laptop cannot run this 14B model locally. A compatible hosted GPU runtime is required.
4. ZeroGPU usage, duplication permissions, hardware quotas, and plan restrictions are controlled by Hugging Face and may change. Do not assume unlimited free generation.
5. The app's current Vercel API is separate. Do not put Hugging Face tokens in frontend code or commit secrets.

## Next integration step

After the source mirror appears, use it to create/duplicate a Hugging Face Space that you control, confirm the Space can generate one short video, then connect AnimateText Studio to that Space through a server-side endpoint. This avoids relying on browser-to-Gradio connections, which failed in our earlier tests.

## Attribution and licensing

The mirrored files retain their upstream content. Review the upstream Space, Wan model, and any included LoRA/model card licences before redistributing or deploying. Upstream source: https://huggingface.co/spaces/zerogpu-aoti/wan2-2-fp8da-aoti-faster
