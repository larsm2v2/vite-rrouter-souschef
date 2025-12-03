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

## Running with Google Cloud services (Pub/Sub & Secret Manager)

The application can optionally use Google Cloud services (Pub/Sub for OCR jobs and Secret Manager for runtime secrets). Those clients require Application Default Credentials (ADC) to be present when initializing the client.

- Local dev without GCP: The server is resilient when Google Cloud credentials are absent. Pub/Sub topics are checked lazily and if unavailable the server falls back to synchronous OCR processing. Secret Manager is also lazily initialized; missing credentials won't crash the server.
- Running the OCR worker or using Pub/Sub features: If you plan to run the OCR worker or use Pub/Sub in dev, set up ADC (for local development, use `gcloud auth application-default login` or set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON file). Without credentials, the OCR worker will not start and Pub/Sub calls will fail.

Example to set up ADC for local development (PowerShell):

```powershell
# Install gcloud SDK (if not installed) and authenticate
gcloud auth application-default login

# Or set a service account JSON path
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\sa.json'
```

If the worker or Pub/Sub initialization fails due to credentials, logs will show a descriptive error and the server will continue to operate without Pub/Sub processing.

## Local cookie-based refresh troubleshooting
- When running `client` on a different port than `server` in development, cross-site cookies may be blocked by the browser and `POST /auth/refresh` will not carry the `refreshToken` HttpOnly cookie. If you experience immediate logouts after a short time due to failed refresh requests, try one of these approaches:
  - Use the Vite dev proxy by running `client` dev server as-is (the repository includes a proxy in `client/vite.config.ts`) and start `server` with `npm run newDev`; this avoids cross-site cookie rejections.
  - Alternatively, use HTTPS for both client and server with `SameSite=None` if you need cross-site cookies over secure transport.
  - For debugging, `GET /auth/debug/cookies` prints incoming cookies so you can verify whether the cookie landed on the server-side.
