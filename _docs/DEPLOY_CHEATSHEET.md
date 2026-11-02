# Deploy cheatsheet

Frontend: Firebase Hosting. Backend: Cloud Run service `souschef-api` (us-central1). Replace `<PROJECT_ID>`, `<FIREBASE_PROJECT>` and `<API_URL>` with your values.

> **Remember**
>
> - **Server (`souschef-api`) and `clean-recipe-service` deploy automatically from Cloud Build triggers** when you push. The manual `gcloud builds submit` commands below are a fallback, not the normal path.
> - **The Firebase client does not.** Deploy it by hand (section 3), and only **after the server build is green**.
> - Pushing is therefore what starts the server deploy. Wait for it to finish before deploying the client.

## What needs deploying for the current work

| Part                        | Redeploy?       | How                    | Why                                                                                                                                         |
| --------------------------- | --------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `server` (`souschef-api`)   | **Yes, first**  | Trigger on push        | Fixes grocery autosave and adds `baseVersion` conflict checks, saved-recipe editing, scaled add-to-grocery, URL import, OCR and OAuth fixes |
| `client` (Firebase Hosting) | **Yes, second** | **Manual** (section 3) | Cook mode, timers, scaler, grocery merge/undo/conflict merge, import drafts, saved-recipe editor, mobile shell, toast-safe focus traps      |
| `clean-recipe-service`      | No              | Trigger on push        | No changes since `origin/main`; its trigger may rebuild it anyway, which is harmless                                                        |
| Database schema             | No              | -                      | No migration or schema file changed                                                                                                         |
| Secrets / env vars          | No              | -                      | No new `process.env` or `import.meta.env` names                                                                                             |

**Order matters.** `baseVersion` is optional on the server, so an old client works against the new server. A new client against the old server still gets 500s on every grocery save, so the server build must finish first.

## 1. Before you deploy

```powershell
# Commit everything; the Cloud Build triggers build what you push.
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

Normal path: **pushing starts the Cloud Build trigger** for `souschef-api` (and `clean-recipe-service`). Watch it finish before touching the client:

```powershell
gcloud config set project <PROJECT_ID>
gcloud builds list --ongoing                       # anything still building?
gcloud builds list --limit 3                       # status of the latest builds (SUCCESS / FAILURE)
gcloud builds log --stream <BUILD_ID>              # follow one build
```

Manual fallback (trigger disabled, or you need to redeploy without a push):

```powershell
gcloud auth list                                   # confirm the active account
gcloud config set project <PROJECT_ID>

# Server only (does not touch clean-recipe-service)
gcloud builds submit --config=server/cloudbuild.yaml server --project <PROJECT_ID>
```

Both paths run `server/cloudbuild.yaml` (assuming the trigger points at it): it builds the image, deploys with `RUN_MIGRATIONS=true`, waits for `/debug/routes` to list the OAuth route, then sets `RUN_MIGRATIONS=false`. A green build means the revision is serving.

Verify:

```powershell
$api = gcloud run services describe souschef-api --region us-central1 --platform managed --format "value(status.url)"
curl.exe -s "$api/debug/routes" | Select-String "/api/oauth/google/token"
gcloud run revisions list --service souschef-api --region us-central1 --limit 3
```

To redeploy both services together by hand, use `.\scripts\deploy-cloudrun.ps1 -ProjectId <PROJECT_ID>`.

## 3. Deploy the client (Firebase Hosting): manual

The client is **not** on a trigger. Deploy it yourself once the server build above is `SUCCESS`.

Firebase Hosting has no environment settings. The variables are read when the client is **built** and baked into the bundle, so "adding the vars" means loading them before the build. They come from your `client/.env`; no values live in this doc. Run these in order (the loaded values last for this terminal window only), **all in the same terminal window**:

```powershell
cd client

# 1. Load every KEY=VALUE line from client/.env into this terminal, then check the three we need
#    (copy this whole block: the check does nothing useful without the loader above it)
Get-Content .env | Where-Object { $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=' } | ForEach-Object {
  $name, $value = $_ -split '=', 2
  Set-Item -Path "Env:$($name.Trim())" -Value $value.Trim().Trim('"').Trim("'")
}
$env:VITE_DEV_BYPASS = $null                                     # never in a deploy build
foreach ($v in "VITE_API_URL", "VITE_GOOGLE_CLIENT_ID", "FIREBASE_PROJECT") {
  if (-not (Get-Item "Env:$v" -ErrorAction SilentlyContinue)) { Write-Warning "$v was not loaded: check the line is in client/.env and that you ran the loader above in this same terminal" }
}

# 2. Build (stop `npm run dev` first: it locks esbuild.exe and npm ci fails with EPERM)
# If an install was interrupted, delete client\node_modules completely before re-running npm ci;
# a half-deleted folder can make npm report success while packages such as react are missing.
fnm exec --using 24 npm.cmd ci
fnm exec --using 24 npm.cmd run build

# 3. Check the bundle: the first command prints a match, the second prints nothing
$apiHost = ([uri]$env:VITE_API_URL).Host
Select-String -Path dist\assets\*.js -Pattern $apiHost -SimpleMatch -List | Select-Object -First 1
Select-String -Path dist\assets\*.js -Pattern "VITE_DEV_BYPASS" -List

# 4. Deploy (npx needs node on PATH, so wrap it in fnm like the other commands)
fnm exec --using 24 npx.cmd firebase-tools login:list                 # already logged in? then skip the next line
fnm exec --using 24 npx.cmd firebase-tools login                      # first time only
fnm exec --using 24 npx.cmd firebase-tools projects:list              # confirm FIREBASE_PROJECT is in this list
fnm exec --using 24 npx.cmd firebase-tools deploy --project $env:FIREBASE_PROJECT --only hosting
```

Then open your hosting URL and hard-refresh.

Notes: `client/.env` needs `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` and a `FIREBASE_PROJECT=` line (the Firebase project id). Loading `.env` into the shell also overrides any stale value Vite would otherwise pick up. `client/.env.development` sets `VITE_DEV_BYPASS=true`, but only `npm run dev` reads it, not `npm run build`.

The repo also contains `.github/workflows/firebase-deploy-client.yml` (deploys on push to `main`, then runs Playwright against the live site on all five browsers). It is not what you rely on; if you ever turn it on, it needs the secrets `FIREBASE_TOKEN`, `FIREBASE_PROJECT` and `VITE_API_URL`, and it would deploy the client at push time, before the server build has finished.

## 4. Smoke test the live site

1. Log in, open a recipe, press **Cook**, start a timer, scale servings.
2. Add a recipe to the grocery list, **reload**: the list must still be there (this was broken before).
3. Open the app in two tabs, add a different item in each: the second save shows "Your change was merged with it" and both items remain.
4. Delete a grocery item and press **Undo** in the toast.
5. Create Recipe, paste text, parse, remove an ingredient and press **Undo**.
6. Open an owned recipe, edit its name, ingredients and instruction, save, then reload to verify the changes persisted.
7. Try a URL import; if direct fetch is blocked, paste recipe text in the fallback editor, parse and save.
8. On a phone: bottom dock, drawer, and nothing scrolls sideways.

If the page looks stale, hard-refresh: `index.html` is revalidated, hashed assets are not.

## 5. Rollback

```powershell
# Cloud Run: send traffic back to the previous revision
gcloud run revisions list --service souschef-api --region us-central1
gcloud run services update-traffic souschef-api --region us-central1 --to-revisions <PREVIOUS_REVISION>=100
```

Firebase: console, Hosting, Release history, **Rollback** on the previous release. The server rolls back with the traffic command above; reverting the commit and pushing would also start a new server build via the trigger.

## 6. Gotchas

- `VITE_API_URL` is baked in at build time. A bundle built without it, or with `<DB_HOST>`, breaks every API call.
- Never set `VITE_DEV_BYPASS` in a deploy build.
- Pushing deploys the server and microservice (triggers) but **not** the client. Forgetting the manual Firebase step leaves users on the old frontend.
- The Playwright suite passes on all five projects locally (Chromium, WebKit, Firefox, Mobile Chrome, Mobile Safari: 490 tests, 0 failed). Run it against production only if you enable the GitHub workflow.
- Node 24 everywhere (Dockerfiles, workflows, `engines`).
- Old grocery items saved before recipe tracking have no source tag. Deselecting an old recipe subtracts its amounts from untagged lines of the same name; this can be undone from the toast.
- Run `scripts/sync-shared-logic.ps1` after editing `groceryMerge.ts` or `recipeMath/*`, or the server drift test fails.
