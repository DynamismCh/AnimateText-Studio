# AnimateText Studio

Children’s animated-series creator built with React, TypeScript, Vite, Tailwind CSS, and an AppDeploy-hosted API.

## Current source snapshot

This repository is a backup of the source currently available from the AppDeploy project `animatetext-0cv969` (snapshot version `1790912718446`). It preserves the original app source before further upgrades.

## Important portability note

The original frontend imports `@appdeploy/client`, and the backend imports `@appdeploy/sdk`. These platform-specific packages and the hosted AI/image-generation/storage services are not included in this repository. The code is backed up, but it will need those AppDeploy services or replacements before it can run independently outside AppDeploy.

## Frontend

- React + TypeScript + Vite
- Tailwind CSS
- Character uploads and selection
- Story/episode generation through the hosted API
- Browser speech synthesis and WebM export

## Source of truth

This repository is intended as a private backup and starting point for making the app portable. Do not commit API keys, passwords, or other secrets.
