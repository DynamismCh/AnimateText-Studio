---
title: AnimateText LTX Video Lite
emoji: 🎬
colorFrom: blue
colorTo: purple
sdk: gradio
sdk_version: 5.34.2
app_file: app.py
pinned: false
---

# AnimateText Studio — LTX Video Lite (ZeroGPU)

A minimal Gradio front end for testing the LTX-Video 2B distilled model on Hugging Face ZeroGPU. It supports text-to-video and image-to-video and outputs a short MP4 preview.

## Deploy

1. On Hugging Face, create a **new public Space** and select **Gradio** as the SDK.
2. In the Space Settings, choose **ZeroGPU** hardware if the setting is offered to your account.
3. Copy the contents of this `hf-space` folder into the root of that Space: `app.py`, `requirements.txt`, and this `README.md`.
4. Wait for the Space to build. The first generation downloads the model and text encoder and can take a while.
5. Test a short text prompt first, then try uploading a Sunny or Bloop image.

ZeroGPU has a small daily allowance on free accounts and a maximum GPU duration per call. Generation may time out, queue, or use a large part of your allowance. It is a testing route, not unlimited free rendering.

## Model and code licenses

The LTX inference source is installed from the official upstream repository; this adapter does not redistribute the upstream source tree or weights. LTX-Video code is Apache-2.0. The 0.9.6 model weights have separate terms; read the exact model license and model card before use. Never commit model weights or private character images to GitHub.

- Upstream code: https://github.com/Lightricks/LTX-Video
- Model: https://huggingface.co/Lightricks/LTX-Video
- ZeroGPU docs: https://huggingface.co/docs/hub/spaces-zerogpu
