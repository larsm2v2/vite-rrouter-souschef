# Copilot / AI Agent Instructions — vite-rrouter-souschef

## Big picture

- Monorepo with three main components:
  - `server/` (TypeScript, Clean Architecture): API, JWT auth, DB migrations, DI container and a layered `01_entities` -> `02_use_cases` -> `03_adapters` -> `04_factories` -> `05_frameworks` -> `06_app` layout.
  - `client/` (React + Vite): SPA built with Vite, deployed to Firebase Hosting. Builds must embed `VITE_API_URL` at build time.
  - `clean-recipe-service/` (TypeScript microservice): in-memory canonicalization and recipe normalization; used by `server` for recipe cleaning and by OCR worker.

## Key files / entrypoints (use these as anchors)

- Backend production entry: `server/src/06_app/main.ts` (boots DI, validates env, optional migrations with `RUN_MIGRATIONS=true`).
- Backend DI container: `server/src/04_factories/di.ts` (registers repositories, use-cases, controllers). Keep `reflect-metadata` import before DI boot.
- Backend routes and frameworks: `server/src/05_frameworks/myexpress/` (controllers, routes, `auth-google-pkce.routes.ts` implementing PKCE/OAuth flows).
- Client app root: `client/src/main.tsx` and `client/src/components` (PKCE helpers in `client/src/utils/pkce` and login UI in `client/src/components/auth`).
- Microservice entry: `clean-recipe-service/src/index.ts`, main logic in `src/cleanRecipe.ts` and `src/synonyms.ts`.

## Developer Workflows — Scripts & Commands (PowerShell examples)

- Server: build/test/dev

  - Install: `cd server; npm ci`
  - Dev (DI + production-like bootstrap): `cd server; npm run newDev` or `npm run dev` (both run `ts-node src/06_app/main.ts`)
  - Build: `cd server; npm run build`
  - Start (production JS): `cd server; npm start` (runs `node dist/06_app/main.js`)
  - Tests: `cd server; npm test` (Jest runs unit & integration tests)
  - Run DB migrations: `cd server; npm run migrate` (or `npm run migrate:new` for creating migrations)

- Client: dev/build/e2e/deploy

  - Dev server: `cd client; npm ci; npm run dev` (default Vite port 5173)
  - Build: `cd client; npm run build` (ensure `VITE_API_URL` is set at build time for production bundles)
  - E2E tests: `cd client; npm run e2e` (Playwright; `npx playwright install` needed first)
  - Deploy: `cd client; npm run build; npx firebase-tools deploy --project "$env:FIREBASE_PROJECT" --only hosting`

- Clean recipe service:
  - Dev: `cd clean-recipe-service; npm ci; npm run dev` (defaults to port 6000)
  - Build / start: `npm run build; npm start`
  - Add synonyms: edit `clean-recipe-service/src/synonyms.ts` — the reverse map rebuilds on module load.

## CI / Integration Notes (how tests run and CI expectations)

- GitHub Actions start `clean-recipe-service` in the CI job and set `CLEAN_RECIPE_SERVICE_URL` to `http://127.0.0.1:6000` before running server tests. Example in `.github/workflows/server-ci.yml`.
- Playwright E2E (`.github/workflows/playwright-e2e.yml`) runs in CI across multiple browsers with a dev server started by the Playwright runner; set `PLAYWRIGHT_BASE_URL` to run tests against deployed sites.

Dev cookie & auth tips

- When running the client and server locally on different ports, cookie-based refresh may fail because browsers block cross-site cookies when used in XHR/Fetch POST requests due to SameSite rules. To avoid this in local development, use the Vite dev proxy (already added to `client/vite.config.ts`) so `/auth` and `/api` calls appear same-origin. This prevents the browser from rejecting `refreshToken` HttpOnly cookie when calling `POST /auth/refresh`.
- If you're still seeing refresh failures, confirm the request carries the Cookie header using the `/auth/debug/cookies` endpoint and ensure your origin is allowed by `server/src/05_frameworks/myexpress/gateway/cors.ts` (we include `http://localhost:5173` and `http://127.0.0.1:5173` by default).

## Conventions and patterns to follow

- Clean Architecture folder numbering matters: `01_entities` -> `06_app` is the canonical bootstrap path. Keep DI registration in `04_factories/di.ts` and use `tsyringe` for runtime injection.
- Use `reflect-metadata` before DI and framework imports. Do not reintroduce `src/app.ts` session-based wrapper in production (JWT first middleware used in `06_app`).
- When editing auth, update both server PKCE logic (`server/src/05_frameworks/myexpress/routes/auth-google-pkce.routes.ts`) and client PKCE helpers (`client/src/utils/pkce` and `client/src/components/auth`).
- The client uses `import.meta.env.VITE_API_URL` at runtime only for the build; always set the env variable at build time for deploys (CI or local `client/.env.production`).

## Integration points / external dependencies to be careful with

- Google OAuth & PKCE: `VITE_GOOGLE_CLIENT_ID`, server secret setup; `auth-google-pkce` code stores the PKCE session cookie (`pkce_session`) then emits redirect to `CLIENT_URL` with access token in fragment.
- Google Generative AI and other Google APIs: see `server` dependencies (`@google/generative-ai`, `@google-cloud/*`) — ensure the correct API key and secret manager setup.
- DB: server uses Postgres; tests rely on an initialized DB. See `server/jest.global-setup.ts` and `server/05_frameworks/database` to boot local test DB.
- Secrets: avoid adding hard-coded secrets in code; CI uses `FIREBASE_TOKEN`, `FIREBASE_PROJECT`, `VITE_API_URL` secrets. Cloud Run uses `--set-secrets` or Secret Manager hooks.

## Testing & Debugging tips (project specifics)

- To reproduce E2E authentication issues: use `client` dev bypass (`VITE_DEV_BYPASS=true`) and open `/dev-login` to simulate a logged-in session.
- To run server tests locally while depending on `clean-recipe-service`, start it on port 6000: `cd clean-recipe-service; npm run dev` and then `cd server; CLEAN_RECIPE_SERVICE_URL=http://127.0.0.1:6000 npm test`.
- In server tests, look for `jest.global-setup.ts` and `testTeardown.js` to see how the DB is initialized and cleaned up.

## Troubleshooting Auth Refresh

If auth always logs users out shortly after login, the root cause is usually that the HttpOnly refresh cookie is not being sent on the refresh request. Follow these steps:

1. Confirm token flow works server-side with integration test or `supertest` (we added `server/src/07_tests/06_app/routes/auth.refresh.integration.test.ts` to exercise register -> refresh flow).
2. Verify client uses `withCredentials: true` for refresh requests (see `client/src/components/pages/Client.tsx` axios interceptor — we use `withCredentials` on refresh calls).
3. Check the `Set-Cookie` header on login/register (devtools Network > login) to ensure `Set-Cookie: refreshToken=` is present and contains HttpOnly flag.
4. Confirm the browser includes the cookie when calling refresh (Network > select /auth/refresh request > check `Request Headers > Cookie`): if Cookie is missing, likely CORS/SameSite policy is the issue.
5. Use the Vite dev proxy (already added) to make the client and server appear same-origin during development; this is the recommended approach for reading/writing cookies in dev.
6. If you need cookies to be sent cross-site over HTTPS, ensure `SameSite=None` and `secure=true` are used and that your local server runs via HTTPS.

Advanced debug commands:

```powershell
# Show debug cookies from server endpoint
curl -i http://localhost:8000/auth/debug/cookies

# Quick check for cookie being set in response headers after login (via curl)
curl -i -X POST -H "Content-Type: application/json" -d '{"email":"x@x.com","password":"P@ssw0rd"}' http://localhost:8000/auth/login
```

If you still see refresh issues after following the above, check logs and the `isRefreshTokenValid()` diagnostic warnings printed by the server. They will include `No refresh token record found` or `revoked` status and are the next place to investigate.

## Safety checks & gotchas

- Do NOT set `VITE_DEV_BYPASS` in production or CI; it is a local dev helper only.
- When building the client for deploy, ensure `VITE_API_URL` points to a publicly reachable API (not `localhost`).
- Production server entrypoint `06_app/main.ts` does not enable legacy session middleware — if you need session-based flows for local debugging, create a dev-only shim that mounts the legacy session middleware only in `NODE_ENV=development`.
- Avoid importing `src/app.ts` (deprecated) into production code; it can create duplicate Express apps.

## Example tasks for AI agents

- Fix a regression in PKCE token storage flow: update `client/src/utils/pkce.*`, verify `GoogleLoginButton.tsx`, and write/adjust Playwright tests in `client/e2e/tests/`.
- Add a new synonym to the microservice: update `clean-recipe-service/src/synonyms.ts`, add unit tests in `synonyms.test.ts`, and verify integration with `server` tests by running local CI steps.
- Add a new endpoint for OCR: wire-up `server/src/05_frameworks/myexpress/routes/ocr.ts`, update the worker (`src/workers/ocr-worker.ts`), and add integration tests.

---

If anything is unclear or you want me to add specific examples (like sample PR descriptions or exact test-cases), tell me which area to expand and I’ll update this file. ✅
