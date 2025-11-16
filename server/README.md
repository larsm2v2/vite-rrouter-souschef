# Server: Entrypoints & Deployment

This document explains the entrypoints and how to build/deploy the `server` service.

## Entrypoints

`src/app.ts` — legacy/dev entrypoint (removed). This repository previously included a lightweight compatibility wrapper at `src/app.ts` which could create a second Express instance when accidentally imported; it has been removed. Use the structured startup via `src/06_app/main.ts` and the canonical framework app at `src/05_frameworks`.

- `src/06_app/main.ts` — recommended canonical entrypoint. This file initializes `reflect-metadata`, boots the DI container, validates the environment, ensures DB migrations, and starts the server. Production builds and deployment should use the compiled `dist/06_app/main.js` file.

## NPM scripts

- `npm run build` — compiles TypeScript to `dist/`.
- `npm start` — runs `node dist/06_app/main.js` (production start).
- `npm run dev` — starts the structured dev entry (`ts-node src/06_app/main.ts`).
- `npm run newDev` — starts the structured dev entry (`ts-node src/06_app/main.ts`).

Use `newDev` if you want the DI/bootstrap behavior and the JWT-first setup used in production.

## Docker / Cloud Build / Cloud Run

- Production container image runs the compiled entrypoint

  CMD: `node dist/06_app/main.js`

- The included `cloudbuild.yaml` builds and pushes a Docker image from the `server/` context and then deploys it to Cloud Run. The Cloud Build expects a `server/Dockerfile` to exist and that the Docker image runs the compiled entrypoint above.

If you are using Cloud Run or CI, ensure the service is configured to use port `8000` (the app listens on this port by default).

## JWT migration status

- The project has migrated to a JWT-based authentication flow for production (access + refresh tokens). The production entrypoint (`06_app`) does not enable session middleware. The legacy `src/app.ts` wrapper has been removed; it previously contained session-based code for local dev.

## Notes

- If you need to reproduce the old session-based local dev flow, add a dev-only shim that imports the framework app (`src/05_frameworks/index.ts`) and mounts session middleware. Production builds and containers still use JWT tokens via `dist/06_app/main.js`.
