# Server: Entrypoints & Deployment

This document explains the entrypoints and how to build/deploy the `server` service.

## Entrypoints

- `src/app.ts` — legacy/dev entrypoint. Historically used for local development and contains session-based authentication code (express-session + passport). Keep this file for compatibility and quick dev testing, but prefer the structured startup below.

- `src/06_app/main.ts` — recommended canonical entrypoint. This file initializes `reflect-metadata`, boots the DI container, validates the environment, ensures DB migrations, and starts the server. Production builds and deployment should use the compiled `dist/06_app/main.js` file.

## NPM scripts

- `npm run build` — compiles TypeScript to `dist/`.
- `npm start` — runs `node dist/06_app/main.js` (production start).
- `npm run dev` — starts the legacy dev entry (`ts-node src/app.ts`).
- `npm run newDev` — starts the structured dev entry (`ts-node src/06_app/main.ts`).

Use `newDev` if you want the DI/bootstrap behavior and the JWT-first setup used in production.

## Docker / Cloud Build / Cloud Run

- Production container image runs the compiled entrypoint

  CMD: `node dist/06_app/main.js`

- The included `cloudbuild.yaml` builds and pushes a Docker image from the `server/` context and then deploys it to Cloud Run. The Cloud Build expects a `server/Dockerfile` to exist and that the Docker image runs the compiled entrypoint above.

If you are using Cloud Run or CI, ensure the service is configured to use port `8000` (the app listens on this port by default).

## JWT migration status

- The project has migrated to a JWT-based authentication flow for production (access + refresh tokens). The production entrypoint (`06_app`) does not enable session middleware. The legacy `src/app.ts` still contains session-based code and is retained for development/testing only.

## Notes

- If you need to roll back to session cookies for any reason, use the legacy `src/app.ts` behavior (or the `dev` script). The production `start` script and Dockerfile target `dist/06_app/main.js` and will not enable session middleware.
