# Deploy cheatsheet

Frontend: Firebase Hosting. Backend: Cloud Run service `souschef-api` (us-central1).

## Quick start

The **backend deploys itself**: pushing to `main` starts your Cloud Build triggers. You deploy the **client** (Firebase Hosting) with one script:

```powershell
.\scripts\deploy-client.ps1 -DryRun   # rehearsal: checks, tests, build; does not deploy
.\scripts\deploy-client.ps1           # the real thing (asks you to type "deploy" first)
```

What it does, stopping on the first failure:

1. **Preflight:** `git`/`fnm`, shared-logic sync, clean git tree, `client/.env` loaded (values never printed), rejects a `VITE_API_URL` that is not public.
2. **Checks the live backend** (read-only) has the routes this client calls (`/api/planner/settings`, `/api/meal-plan`, `/auth/refresh`). If your trigger has not finished, it tells you to wait instead of shipping a client that 404s.
3. **Tests:** client unit tests and lint.
4. **Build:** `npm ci`, production build, and checks that the bundle contains your API host and no `VITE_DEV_BYPASS`.
5. **Deploy:** `firebase deploy --only hosting`, then confirms the live site serves the bundle it just built.

| Option             | Effect                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- |
| `-DryRun`          | Runs everything except `firebase deploy`.                                               |
| `-SkipTests`       | Skip unit tests and lint (the build still runs).                                        |
| `-SkipInstall`     | Skip `npm ci`. Needed while `npm run dev` is running (it locks esbuild).                |
| `-SkipServerCheck` | Deploy even if the live backend lacks the new routes.                                   |
| `-AllowDirty`      | Deploy with uncommitted changes. By default the tree must be clean.                     |
| `-Yes`             | Do not ask for confirmation.                                                            |
| `-FirebaseProject` | Override `FIREBASE_PROJECT` from `client/.env`.                                         |

Requirements: `git`, `fnm`, and a `client/.env` with `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` and `FIREBASE_PROJECT`. First time only, log in to Firebase: `cd client; fnm exec --using 24 npx.cmd firebase-tools login` (or set `FIREBASE_TOKEN`). Works in Windows PowerShell 5.1 and PowerShell 7.

### Backend fallback

Only if a trigger did not fire or failed and you cannot push again:

```powershell
.\scripts\deploy-server.ps1 -DryRun
.\scripts\deploy-server.ps1 -SkipTests -Yes     # add -IncludeCleanService for clean-recipe-service too
```

It runs `gcloud builds submit server/cloudbuild.yaml`, verifies the live routes, prints why a build failed, and prints the rollback command. Check trigger builds with `gcloud builds list --limit 3`.

Both scripts share `scripts/deploy-common.ps1`. The **GitHub Actions** "Firebase Deploy Client" workflow is a separate path and requires the repository secrets `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` (see section 3); the script does not depend on it.

`client/firebase.json` explicitly selects the Hosting site `souschef4me` so CI
does not depend on default-site discovery or an untracked local `.firebaserc`.
When deploying to another project, also update `hosting.site` to that project's
site ID; `--project` alone does not override the configured site.

The rest of this document is the manual reference for each step. Replace `<PROJECT_ID>`, `<FIREBASE_PROJECT>` and `<API_URL>` with your values in the commands below.

> **Remember**
>
> - **Server (`souschef-api`) and `clean-recipe-service` deploy automatically from Cloud Build triggers** when you push.
> - **The Firebase client is deployed by `deploy-client.ps1`.** The GitHub Actions workflow (`firebase-deploy-client.yml`) also tries on pushes to `main`, independently of the Cloud Build triggers, so it can run before the backend is ready.

## What needs deploying for the current work

| Part                        | Redeploy?      | How                                         | Why                                                                                                                                                                |
| --------------------------- | -------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `server` (`souschef-api`)   | **Yes, first** | Trigger on push (fallback `deploy-server.ps1`) | Meal planner API (meal plan, leftovers, cooking history, auto-favorites), staples fixes, session renewal (refresh grace window, auth rate limits), URL import fixes |
| `client` (Firebase Hosting) | **Yes**        | `.\scripts\deploy-client.ps1`               | Meal planner page and Settings tab, edit-from-URL, staples UI, background session renewal                                                                          |
| `clean-recipe-service`      | No             | Trigger on push                             | No changes; its trigger may rebuild it anyway, which is harmless                                                                                                   |
| Database schema             | **Automatic**  | Applied when the server starts              | New tables/columns (`recipe_completions`, `meal_plan` leftovers, `users` planner settings, `refresh_tokens.revoked_at`) are created idempotently on boot             |
| Secrets / env vars          | No             | -                                           | No new `process.env` or `import.meta.env` names                                                                                                                    |

**Order matters:** a new client against an old server 404s on `/api/meal-plan` and `/api/planner/settings`. `deploy-client.ps1` checks for exactly that before it deploys.
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

To redeploy by hand use `.\scripts\deploy-server.ps1` (above), or `.\scripts\deploy-cloudrun.ps1 -ProjectId <PROJECT_ID>` to rebuild both the server and clean-recipe-service.

## 3. Deploy the client (Firebase Hosting): automatic and manual fallback

The normal path is the GitHub Actions workflow `.github/workflows/firebase-deploy-client.yml`, which builds, deploys, and runs Playwright after each push to `main`. It requires the Actions secrets `FIREBASE_PROJECT`, `FIREBASE_SERVICE_ACCOUNT`, `VITE_API_URL`, and `VITE_GOOGLE_CLIENT_ID`. This workflow is independent of Cloud Build and does not wait for the server deployment.

### One-time GitHub Actions service account setup

1. In [Google Cloud Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=souschef4me),
   create `souschef-hosting-deployer` in project `souschef4me`.
2. Grant it **Firebase Hosting Admin** (`roles/firebasehosting.admin`) on this
   project, not Owner or Editor. It does not need Cloud Run permissions.
3. Open the account, then **Keys > Add key > Create new key > JSON**. Treat the
   downloaded file like a password; keep it outside this repository.
4. In [repository Actions secrets](https://github.com/larsm2v2/vite-rrouter-souschef/settings/secrets/actions),
   create `FIREBASE_SERVICE_ACCOUNT` containing the entire JSON file, not its
   filename or just its private key. Keep `FIREBASE_PROJECT` set to `souschef4me`.
5. Commit and push the updated workflow. It uses `google-github-actions/auth@v3`
   to write a temporary credential file and export `GOOGLE_APPLICATION_CREDENTIALS`.
   The action deletes that file when the job ends. No `--token` is used.
6. After a successful deployment, delete the obsolete `FIREBASE_TOKEN` repository
   secret and remove the downloaded local key file once it is securely stored
   in the secret. Removing the local file does not revoke the key in Google Cloud;
   rotate or revoke the cloud key when needed.

If organization policy blocks key creation, do not disable the policy; use
Workload Identity Federation instead. JSON keys are long-lived credentials;
keyless federation is the preferred longer-term option.

If deployment fails with "Failed to get Firebase project", open the workflow's
**Check Firebase project access** step. It makes a read-only Firebase API request
using the same credentials and reports Google's HTTP status, error message, and
permission/service reason when available. It does not print credentials, tokens,
request headers, or the full error object. A failed check stops deployment.

### Manual fallback

The steps below use interactive Firebase login; use them after the server build
is `SUCCESS` when deployment order matters.

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

The workflow builds with `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`, deploys to the project in `FIREBASE_PROJECT`, then runs Playwright against `https://${FIREBASE_PROJECT}.web.app`. A Playwright failure happens after deployment and does not roll back Hosting.

## 4. Smoke test the live site

1. Log in, open a recipe, press **Cook**, start a timer, scale servings.
2. Add a recipe to the grocery list, **reload**: the list must still be there (this was broken before).
3. Open the app in two tabs, add a different item in each: the second save shows "Your change was merged with it" and both items remain.
4. Delete a grocery item and press **Undo** in the toast.
5. Create Recipe, paste text, parse, remove an ingredient and press **Undo**.
6. Open an owned recipe, edit its name, ingredients and instruction, save, then reload to verify the changes persisted. Also try **Update from a web page** inside the editor.
7. Try a URL import; if direct fetch is blocked, paste recipe text in the fallback editor, parse and save.
8. Open **myPlanner**: drag a recipe onto a day, add leftovers from the options (⋯) panel, check a meal off as cooked, then look at **History** and **Settings**.
9. Stay signed in and idle for more than 15 minutes, then click around: you should not be sent to the login page.
10. On a phone: bottom dock, drawer, and nothing scrolls sideways.

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
- Pushing to `main` starts the server and microservice Cloud Build triggers and the Firebase client GitHub Actions workflow. These run independently; the client may deploy before the server build finishes.
- The Firebase workflow runs Playwright against the live site after deployment. A test failure does not undo the deployment.
- The Playwright suite passes on all five projects locally (Chromium, WebKit, Firefox, Mobile Chrome, Mobile Safari: 490 tests, 0 failed).
- Node 24 everywhere (Dockerfiles, workflows, `engines`).
- Old grocery items saved before recipe tracking have no source tag. Deselecting an old recipe subtracts its amounts from untagged lines of the same name; this can be undone from the toast.
- Run `scripts/sync-shared-logic.ps1` after editing `groceryMerge.ts` or `recipeMath/*`, or the server drift test fails.
