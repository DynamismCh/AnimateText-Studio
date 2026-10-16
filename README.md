# AnimateText Studio

Children’s animated-series creator built with React, TypeScript, Vite, and Tailwind CSS.

## Repository

This repository is the source backup for the AppDeploy project `animatetext-0cv969`. The frontend has been adapted to use a standard `fetch()` API wrapper so it can talk to either the AppDeploy backend or the included standalone backend.

## Free standalone backend (first portability milestone)

The included `backend/server.mjs` uses Node.js built-in modules only; it does not require a paid API key or extra server packages. It supports:

- Uploading and deleting character images.
- Creating four-shot storyboards with character actions and dialogue.
- Generating simple SVG scene backgrounds.
- Serving uploaded images and scene backgrounds to the frontend.

**Important trade-off:** this free mode is a basic offline-friendly fallback, not AI image generation. It creates simple illustrated backgrounds and a scripted storyboard. It does not yet provide AI-written stories, generated character art, advanced facial animation, or a complete commercial-grade animation pipeline. Browser voice synthesis and WebM export remain frontend features.

### Run locally

Requirements: Node.js 20 or newer.

1. Install frontend dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set:
   `VITE_API_BASE_URL=http://localhost:8787`
3. Start the backend in one terminal:
   `npm run server`
4. Start the frontend in another terminal:
   `npm run dev`
5. Open the local Vite URL shown in the terminal.

Uploaded characters and generated SVG scenes are stored in the local `data/` folder. Back up this folder if you want to keep your assets. Do not commit private character images.

### Health check

When the backend is running, visit `http://localhost:8787/api/health`. A healthy server returns JSON with `ok: true`.

## Optional LTX-Video GPU service

An experimental adapter now lives in `backend/ltx-video-lite/`. It wraps the official Lightricks LTX-Video inference package and exposes `POST /api/generate` for short text-to-video or image-to-video clips. The frontend can use it when `VITE_LTX_API_URL` points to a running GPU service; if that variable is blank, the current WAN 2.2 image-to-video route remains active.

Read [the LTX Lite setup guide](backend/ltx-video-lite/README.md) before running it. The adapter is committed, but it has **not yet been verified end-to-end on a GPU**. It requires a separate GPU host and downloads model weights on first use; it does not make generation free or practical on the 4 GB Celeron laptop. Do not commit model weights or character uploads.

## Frontend

- React + TypeScript + Vite
- Tailwind CSS
- Character upload and selection
- Four-shot storyboard and character action preview
- Browser speech synthesis, background tones, sound effects, and WebM export

## Current limitations and next work

- The standalone server has been added to the repository, but has not yet been run in a clean environment or verified end-to-end.
- The existing AppDeploy backend file still uses AppDeploy SDK services. The standalone path is the new `backend/server.mjs`; do not assume the AppDeploy deployment now uses it.
- The next verification step is to run the GitHub build check, fix any errors, then test upload → generate → preview → export locally.

## Safety

Do not commit API keys, passwords, or other secrets.
