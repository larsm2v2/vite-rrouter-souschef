# Routes Debug Guide — PKCE & OAuth, Cloud Run, and Local Test Strategy

This doc summarizes the routes issue we've been working on, outlines the server + client architecture, current issues and redundancies, and includes a short checklist and actionable steps ChatGPT (or any search tooling) can use to help find and fix routing-related problems.

## Executive summary

- Problem: `POST /api/oauth/google/token` and other OAuth routes intermittently returned 404 in production (Cloud Run). Locally, tests showed the routes mount correctly. Cloud Run behavior indicated some instances still served older code.
- Root causes: Docker/Cloud Build caching, `.gcloudignore` excluding `dist`, ambiguous route module import (legacy `routes.ts` vs `routes/index.ts`) and inconsistent route mounting ordering.
- Fixes applied so far:
  - Client-side PKCE (verifier in session storage) that calls `POST /api/oauth/google/token` to exchange code → tokens server-side.
  - `routes/index.ts` explicitly imported in `myexpress/index.ts` and `app.ts` to avoid resolution pitfalls caused by `routes.ts` legacy file.
  - Cloud Build: added no-cache flags and updated `.gcloudignore` to include `dist` to reliably ship compiled code.
  - Added `routes.test.ts` to validate router stacks and ensure `oauth` route exists in local tests.

## Architecture overview (key files)

- Server
  - `src/05_frameworks/myexpress/routes/index.ts`: mounts routers using `router.use("/api/oauth", oauthRoutes)` as the first router. Must be the one used in app to guarantee correct ordering.
  - `src/05_frameworks/myexpress/routes/oauth-google.routes.ts`: stateless PKCE token exchange endpoint `POST /google/token` under `/api/oauth` mount point.
  - `src/05_frameworks/myexpress/routes/auth.routes.ts`: legacy /auth routes.
  - `src/05_frameworks/myexpress/index.ts` and `src/05_frameworks/myexpress/app.ts`: import `./routes/index` explicitly to avoid legacy `routes.ts`. Exports router via `routes`.
  - `src/06_app/server.ts`: contains `/debug/routes` which recursively walks the router stack and is used to verify mounted routes. It is sensitive to nested router structure and regex usage for prefixes.
  - `src/07_tests/routes.test.ts`: test file that inspects router stacks and validates that `/api/oauth` is mounted first and that a child route `/google/token` exists.
  - `src/07_tests/06_app/routes/routes.integration.test.ts`: integration checks for `/debug/routes` and existence of token route (router-level check) — avoids depending on external Google token exchange.
- Client (Vite/React)
  - `client/src/utils/pkce.ts`: generate code_verifier + code_challenge and state; stores verifier in sessionStorage.
  - `client/src/components/auth/GoogleLoginButton.tsx` and `GoogleCallback.tsx`: start PKCE flow and exchange tokens at `/api/oauth/google/token`.

## What to search for (useful queries for ChatGPT search tools)

- Files/strings to inspect:
  - `oauth-google.routes`, `auth.routes`, `routes/index`, `myexpress/index`, `app.ts`, `routes.ts` (legacy), `debug/routes`, `cloudbuild.yaml`, `.gcloudignore`
  - Search for `router.use("/api`, `router.use("/auth`, `POST /google/token`, `code_verifier`, `PKCE`, `sessionStorage`, `client/src/utils/pkce`.
- Test queries:
  - `routes.test.ts`, `routes.integration.test.ts`, `routes.stack`, `test mounts /api/oauth`
- Cloud/CI queries:
  - `gcloud builds submit`, `no-cache`, `.gcloudignore dist`, docker caching, Cloud Run revisions.

## Common failure modes and checks

1. Old code still being served on Cloud Run

   - Check Cloud Run service revisions and logs. Look for lines like "Routes mounted successfully. Total routers: X" — those are printed by `routes/index.ts`.
   - If some instances show only health routes, confirm which revision handled that instance. Cloud Run may still service requests from older revisions or there is a `max instances` distribution causing older image to handle some traffic.

2. Route not present in `app` (local tests pass but production doesn't)

   - Verify `myexpress/index.ts` is importing exactly `./routes/index` and _not_ `./routes` or `./routes.ts` (this was a cause of ambiguous importing on case-insensitive filesystems).
   - Make sure `routes/index.ts` is the one compiled in `dist`; confirm `dist/05_frameworks/myexpress/routes/index.js` printed the mount logs.

3. TypeScript type issues blocking dev (e.g., `req.user.id`)

   - There are multiple user shapes and `Express.User` augmentation was previously inconsistent. Follow the pattern used in `src/types/entities/User.ts` and `src/types/express.d.ts` to make `req.user` type consistent and keep it in `typeRoots`.

4. Tests failing due to environment variables and Cloud/Google dependencies
   - Tests should mock external dependencies or run in test mode (NODE_ENV=test). Ensure `src/06_app/environment.ts` relaxes environment checks in dev and `src/06_app/config.ts` provides `isTest`/`isDevelopment` flags.
   - The `oauth` route tests should not rely on Google exchanging tokens. Instead inspect the router stack or mock the token service.

## Checklist: Developer-friendly steps

- Local dev (fast):
  1. Run `npm run dev` in `server` folder after ensuring `NODE_ENV` is not set to `production`.
  2. Use `GET /debug/routes` to confirm `/api/oauth` and `/api/oauth/google/token` are visible.
  3. Run `npm run test` to run the `routes.test.ts` and integration tests.
- Cloud Run deploy (robust):
  1. Run `gcloud builds submit --config cloudbuild.yaml --no-cache` to ensure fresh build.
  2. Avoid `.gcloudignore` blocking `dist`. Confirm `dist` is uploaded and `Dockerfile` uses it (or force `npm run build` inside the Dockerfile).
  3. Redeploy to Cloud Run and use `gcloud run services logs read` filter for `Mounting` messages.
  4. If you see the endpoint still 404, call `/debug/routes` directly and compare logged `Total routers` across instances.

## Recommended changes to reduce future troubleshooting

- Always compile TypeScript in CI and publish `dist` with deploy. If Cloud Run is deployed with compile step in Docker, keep `dist` out of `.gcloudignore`.
- Ensure `myexpress/index.ts` re-exports the canonical `routes/index.ts` (already in repo). Add a unit test that fails when it accidentally imports `routes.ts` (legacy). The test could check `routes` contains the expected mount order.
- Make `/debug/routes` recursion robust (we currently walk nested routers and clean regex) and ensure Cloud Run logs include `Routes mounted successfully`.
- Add test-only `GET /debug/routes?verbose=true` to return richer data for CI.

## Useful Dev grep/semantic search terms (for ChatGPT with workspace search)

- "Mounting /api/oauth" // to find the exact point where oauth routes mount
- "debug/routes" // debug endpoint
- "google/token" // token exchange route
- "routes.stack" // where router mount order is checked
- "passport" "PKCE" "code_verifier" "sessionStorage" // related auth details

## Quick readouts for manual triage

- Local route check: curl http://localhost:8000/debug/routes | jq
- Unit tests: `cd server && npm run test` (or use `npm run test:watch` for dev)
- Rebuild and redeploy: `gcloud builds submit --no-cache --config=cloudbuild.yaml` (to avoid caching) then `gcloud run deploy` or follow `cloudbuild.yaml` steps.

## Appendix: commands to run

- Local server (dev):

```
cd server
npm install
npm run dev
# Confirm debug route exists
curl -s http://localhost:8000/debug/routes | jq .
```

- Run full test suite:

```
cd server
npm run test
```

- Rebuild and force Cloud Build cache bypass (if needed):

```
cd server
# inside project root, use substitutions if your cloudbuild uses them
gcloud builds submit --config cloudbuild.yaml --no-cache
```

## Notes for ChatGPT automation

- Use `semantic_search` with the above queries. Look for `router.use` points and confirm mount order and exact `path` values.
- Pay special attention to ambiguous file names (`routes.ts` vs `routes/index.ts`) and to any place where `import routes from './routes'` may resolve differently depending on file system behavior.
- When pointing out fixes, prefer minimal, low-risk changes: explicit imports, environment toggles for dev mode, and router stack inspection tests that run fast in CI.

## Key file snippets (exact places to inspect)

Below are the current, exact snippets you asked for — copy/paste these into a search or use them as guides for the code lines you should verify. They show order and mount points.

1. `src/05_frameworks/myexpress/routes/index.ts` (mount order)

```ts
import express from "express";
import authRoutes from "./auth.routes";
import oauthGoogleRoutes from "./oauth-google.routes";
import profileRoutes from "./profile";
import recipesRoutes from "./recipes.routes";
import groceryRoutes from "./grocery.routes";
import profileFeatures from "./profileFeatures.routes";

const router = express.Router();

console.log("📋 Mounting routes...");
// Mount all routes — order matters here
console.log("  Mounting /api/oauth → oauth-google routes");
router.use("/api/oauth", oauthGoogleRoutes);
console.log("  Mounting /auth → auth routes");
router.use("/auth", authRoutes);
console.log("  Mounting /api → recipes routes");
router.use("/api", recipesRoutes);
console.log("  Mounting /api → grocery routes");
router.use("/api", groceryRoutes);
console.log("  Mounting / → profile routes");
router.use("/", profileRoutes);
console.log("  Mounting /api → profile features routes");
router.use("/api", profileFeatures);
```

2. `src/05_frameworks/myexpress/index.ts` (explicit import and app wiring)

```ts
// Explicit path to guarantee `./routes/index.ts` is used
export { default as app } from "./app";
export { default as routes } from "./routes/index";
export * from "./middleware";
```

3. `src/06_app/server.ts` (debug route + app mount)

```ts
import { app } from "../05_frameworks/index";
// ...
// Debug endpoint - walk the router stack recursively
app.get("/debug/routes", (req, res) => {
  /* walks app._router.stack and returns routes[] */
});
// The `app` is the same instance exported by the framework — watch for double `app` creation
```

Optional: short version of `POST /google/token` (router-level path)

```ts
// In oauth-google.routes.ts
router.post("/google/token", async (req, res) => {
  // expects { code, code_verifier } — exchanges with Google
  // returns { access_token, user: { id, email, display_name } }
});
```

Short summary (150 lines or less)

- Why this matters: import ambiguity (./routes vs ./routes/index) or wrong mount order can cause `/api/oauth/google/token` to not be attached at the right time or to be shadowed by other middleware.
- What to grep: `router.use("/api/oauth"`, `router.use("/api",`, `route.path === "/google/token"`, and the string printed with `console.log("📋 Mounting routes...")` — use these to confirm the exact file that logs the mount order.
- Action: rely on the `routes.test.ts` router inspection unit test. Make it assert the mount order and not only `routes.stack.length` (i.e., assert `routes.stack[0]` is OAuth router) — that gives a single-failure signal if files are swapped.

Robust route registration example (Vite SSR + Cloud Run)

```ts
// server/src/05_frameworks/myexpress/routes/index.ts
import express from "express";
import oauthRoutes from "./oauth-google.routes";
import authRoutes from "./auth.routes";

// ALWAYS import routes statically at top-level. Do not use conditional/dynamic imports
// or Vite may tree-shake these modules (or cause runtime import failures in SSR).
const router = express.Router();

// Mount in explicit order. Keep oauth first so its endpoints are not shadowed.
router.use("/api/oauth", oauthRoutes);
router.use("/auth", authRoutes);

export default router;
```

Notes:

- Avoid dynamic import() for server-only routes unless you purposely want to lazily load them. Vite's SSR can sometimes alter imports and the bundle if done incorrectly.
- Use top-level console.log statements in each route file (for now) to confirm the file is loaded on Cloud Run.
- Use `app._router.stack` in a startup log to confirm mount points; the debug route uses a similar walk.

---
