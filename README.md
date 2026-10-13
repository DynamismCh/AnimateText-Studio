# AnimateText Studio

Children’s animated-series creator built with React, TypeScript, Vite, Tailwind CSS, and an AppDeploy-hosted API.

## Current source snapshot

This repository is a backup of the source currently available from the AppDeploy project `animatetext-0cv969` (snapshot version `1790912718446`). It preserves the original app source before further upgrades.

## Portability work started

- Replaced the frontend's direct `@appdeploy/client` import with a small standard `fetch()` API wrapper at `src/lib/api.ts`.
- Added `src/vite-env.d.ts` for the optional `VITE_API_BASE_URL` setting.
- Added `.env.example` to document the API URL configuration.

To point the frontend at a separately hosted API, copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to that API's base URL.

## Important limitations

This is not yet a fully standalone deployment. The existing backend still imports `@appdeploy/sdk` and uses AppDeploy AI generation, image generation, and storage services. Those must be replaced with alternatives before the complete application can run outside AppDeploy.

The app also has not yet been built or tested in a clean local environment. Treat this as source preservation and the first portability change, not a confirmed independent working build.

## Frontend

- React + TypeScript + Vite
- Tailwind CSS
- Character uploads and selection
- Story/episode generation through the backend API
- Browser speech synthesis and WebM export

## Safety

Do not commit API keys, passwords, or other secrets.
