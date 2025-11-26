# Deployment Guide (server)

This document lists environment variables and basic deployment steps to run the server and the `clean-recipe-service` microservice in production-like environments.

## Required environment variables

- NODE_ENV — set to `production` in production.
- PORT — port the server listens on (default often: 3000 or set in `src/06_app/main.ts`).
- CLEAN_RECIPE_SERVICE_URL — full URL to the clean-recipe microservice (optional). If unset, the server uses the local cleaner.

## Running migrations during deploy

The Cloud Build pipeline deploys to Cloud Run and will briefly set RUN_MIGRATIONS=true for the new revision so idempotent migrations run once during startup.

The deployment step uses RUN_MIGRATIONS to indicate that the first migraiton pass should run as the revision starts — once migration completes, the pipeline flips RUN_MIGRATIONS back to false so subsequent restarts don't re-run migrations unexpectedly.

This ensures one-time schema work (like creating the `refresh_tokens` table) happens automatically during the first deploy.

- DATABASE_URL or Postgres-specific envs:
  - PGHOST
  - PGUSER
  - PGPASSWORD
  - PGDATABASE
  - PGPORT
  - Alternatively a single `DATABASE_URL` (postgres://user:pw@host:port/db)
- SESSION_SECRET — secret for session cookies (if sessions used).
- JWT_SECRET — secret for JWT signing (if JWTs used).

## Production checklist

1. Configure database and run migrations/schema initialization.
2. Configure environment variables securely (secrets manager or CI/CD secret store).
3. Start the clean-recipe-service (if using microservice): run compiled JS (node dist/index.js) behind a process manager (systemd, PM2, Docker).
4. Start the server behind a reverse proxy (nginx) or a process manager. Set `CLEAN_RECIPE_SERVICE_URL` to the running microservice URL.
5. Health checks: ensure `/health` or a lightweight endpoint responds (implement if missing).

### Service authentication (recommended)

- For production, prefer keeping the `clean-recipe-service` private (require IAM) and allow only the server's Cloud Run service account to invoke it.
- If you deploy the clean service with Cloud Build, remove `--allow-unauthenticated` from the deploy step to require authentication.
- Grant the server's service account the `roles/run.invoker` role on the clean-recipe-service. Example (replace placeholders):

```powershell
gcloud run services add-iam-policy-binding "clean-recipe-service" `
  --region "us-central1" `
  --platform managed `
  --member="serviceAccount:<SERVER_SA_EMAIL>" `
  --role="roles/run.invoker" `
  --project "<PROJECT_ID>"
```

- On the server, set `CLEAN_RECIPE_SERVICE_URL` to the private service URL (for example `https://clean-recipe-service-XXXXX.run.app`) and optionally set `CLEAN_RECIPE_SERVICE_AUDIENCE` to the same URL. The server code will request an ID token and include it as `Authorization: Bearer <ID_TOKEN>` when calling the microservice.

See `clean-recipe-service/AUTH.md` for a step-by-step guide and test commands.

## Running in Docker (suggested)

- Build microservice and server images separately and run them in the same network.
- Example docker-compose service snippet (conceptual):

```yaml
services:
  clean-recipe-service:
    image: myorg/clean-recipe-service:latest
    environment:
      - PORT=6000

  server:
    image: myorg/souschef-server:latest
    environment:
      - CLEAN_RECIPE_SERVICE_URL=http://clean-recipe-service:6000
      - DATABASE_URL=${DATABASE_URL}
```

## Notes on CI

- The repository contains a CI workflow that starts the microservice with `ts-node` for tests. For production CI pipelines, prefer building artifacts (TypeScript → JavaScript) and running `node dist/index.js` or container images.
