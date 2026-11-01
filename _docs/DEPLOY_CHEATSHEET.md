# Deploy cheatsheet

Frontend: Firebase Hosting. Backend: Cloud Run service `souschef-api` (us-central1). Replace `<PROJECT_ID>`, `<FIREBASE_PROJECT>` and `<API_URL>` with your values.

## What needs deploying for the current work

| Part | Redeploy? | Why |
| --- | --- | --- |
| `server` (`souschef-api`) | **Yes, first** | Fixes `POST /api/grocery-list/version` (it always returned 500, so autosave never persisted), adds the `baseVersion` conflict check, scaled add-to-grocery, URL import, OCR and OAuth fixes |
| `client` (Firebase Hosting) | **Yes, second** | Cook mode, timers, scaler, grocery merge/undo/conflict merge, import drafts, mobile shell |
| `clean-recipe-service` | No | No changes since `origin/main` |
| Database schema | No | No migration or schema file changed |
| Secrets / env vars | No | No new `process.env` or `import.meta.env` names |

**Order matters.** `baseVersion` is optional on the server, so an old client works against the new server. A new client against the old server still gets 500s on every grocery save, so deploy the server first.

## 1. Before you deploy

```powershell
# Commit everything; the Firebase workflow only deploys what is on main.
git status                       # should be clean
git log origin/main..HEAD --oneline

# Server: sync shared logic, then test (one suite at a time; never run Jest and Playwright together)
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-shared-logic.ps1
cd server; fnm exec --using 24 npm.cmd test -- --silent; cd ..

# Client: unit tests, type-check + production build, lint
cd client
fnm exec --using 24 npm.cmd run test:unit
fnm exec --using 24 npm.cmd run build
fnm exec --using 24 npm.cmd run lint
cd ..
```

## 2. Deploy the server (Cloud Run)

```powershell
gcloud auth list                                   # confirm the active account
gcloud config set project <PROJECT_ID>

# Server only (does not touch clean-recipe-service)
gcloud builds submit --config=server/cloudbuild.yaml server --project <PROJECT_ID>
```

`server/cloudbuild.yaml` builds the image, deploys with `RUN_MIGRATIONS=true`, waits for `/debug/routes` to list the OAuth route, then sets `RUN_MIGRATIONS=false`. A green build means the revision is serving.

Verify:

```powershell
$api = gcloud run services describe souschef-api --region us-central1 --platform managed --format "value(status.url)"
curl.exe -s "$api/debug/routes" | Select-String "/api/oauth/google/token"
gcloud run revisions list --service souschef-api --region us-central1 --limit 3
```

To redeploy both services together, use `.\scripts\deploy-cloudrun.ps1 -ProjectId <PROJECT_ID>`.

## 3. Deploy the client (Firebase Hosting)

### Option A: push to `main` (automatic)

`.github/workflows/firebase-deploy-client.yml` runs on every push to `main`: installs, builds with the `VITE_API_URL` secret, deploys, then runs the Playwright suite against `https://<FIREBASE_PROJECT>.web.app`.

```powershell
git push origin main
```

Needs repo secrets `FIREBASE_TOKEN`, `FIREBASE_PROJECT`, `VITE_API_URL`. Watch the run in the GitHub Actions tab.

### Option B: manual deploy

```powershell
cd client
$env:VITE_API_URL = "<API_URL>"          # must be the public API, never localhost
fnm exec --using 24 npm.cmd ci
fnm exec --using 24 npm.cmd run build

# Confirm the API URL was baked into the bundle
Select-String -Path dist\assets\*.js -Pattern "<API_HOST>" -List | Select-Object -First 1

npx firebase-tools login                 # first time only
npx firebase-tools deploy --project "<FIREBASE_PROJECT>" --only hosting
```

## 4. Smoke test the live site

1. Log in, open a recipe, press **Cook**, start a timer, scale servings.
2. Add a recipe to the grocery list, **reload**: the list must still be there (this was broken before).
3. Open the app in two tabs, add a different item in each: the second save shows "Your change was merged with it" and both items remain.
4. Delete a grocery item and press **Undo** in the toast.
5. Create Recipe, paste text, parse, remove an ingredient and press **Undo**.
6. On a phone: bottom dock, drawer, and nothing scrolls sideways.

If the page looks stale, hard-refresh: `index.html` is revalidated, hashed assets are not.

## 5. Rollback

```powershell
# Cloud Run: send traffic back to the previous revision
gcloud run revisions list --service souschef-api --region us-central1
gcloud run services update-traffic souschef-api --region us-central1 --to-revisions <PREVIOUS_REVISION>=100
```

Firebase: console, Hosting, Release history, **Rollback** on the previous release. Or `git revert` the commit and push.

## 6. Gotchas

- `VITE_API_URL` is baked in at build time. A bundle built without it, or with `localhost`, breaks every API call.
- Never set `VITE_DEV_BYPASS` in a deploy build.
- The post-deploy workflow runs **all five** Playwright projects (Chromium, WebKit, Firefox, Mobile Chrome, Mobile Safari). Locally, only Chromium and Mobile Chrome have been run on this work. A red check there does not roll the deploy back.
- Node 24 everywhere (Dockerfiles, workflows, `engines`).
- Old grocery items saved before recipe tracking have no source tag. Deselecting an old recipe subtracts its amounts from untagged lines of the same name; this can be undone from the toast.
- Run `scripts/sync-shared-logic.ps1` after editing `groceryMerge.ts` or `recipeMath/*`, or the server drift test fails.
