# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ["./tsconfig.node.json", "./tsconfig.app.json"],
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    "react-x": reactX,
    "react-dom": reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs["recommended-typescript"].rules,
    ...reactDom.configs.recommended.rules,
  },
});
```

## End-to-end tests

This project includes a small Playwright E2E test that verifies the PKCE tokens are stored in sessionStorage before the OAuth redirect.

Install Playwright and browsers locally:

```powershell
cd client
npm i -D @playwright/test
npx playwright install
```

Run tests:

```powershell
npm run e2e
```

### Development bypass for authentication (optional)

If you are seeing PKCE/sessionStorage persistence issues in development, you can enable a safe development-only bypass that simulates a logged-in user without going through Google OAuth.

1. Set a local env var in `client/.env.development` or your shell:

```powershell
# enable the dev bypass (ONLY for local development)
$env:VITE_DEV_BYPASS = 'true'
```

Or add to `client/.env.development`:

```dotenv
VITE_DEV_BYPASS=true
```

2. Start the dev server and open: `http://127.0.0.1:5173/dev-login`

3. Click the **Simulate Sign In (Dev)** button to populate a fake user and token in `localStorage` and navigate to `/profile`.

Important: This bypass is strictly for local development. Do NOT enable `VITE_DEV_BYPASS` in production or CI. Remove the env var before deploying.

The E2E tests start the Vite dev server automatically and run against `http://127.0.0.1:5173`.

Run Safari-like tests using WebKit:

```powershell
npx playwright install webkit
npm run e2e:webkit
```

Note: Playwright's WebKit project runs the Safari engine (WebKit) — this is the supported way to test Safari behavior cross-platform. It emulates Desktop Safari via the `devices['Desktop Safari']` preset. If you need to validate the actual Safari application on macOS use Apple's safaridriver instead.

Run Firefox tests:

```powershell
npx playwright install firefox
npm run e2e:firefox
```

## Deploying to Firebase

These repository files include a GitHub Actions workflow and a Firebase hosting configuration to build and deploy the `client` site on pushes to the `main` branch:

- `client/firebase.json` — Hosting configuration (publishes `dist/` and rewrites to `index.html`).
- `.github/workflows/firebase-deploy-client.yml` — CI workflow that builds `client` and deploys with `firebase-tools`.

### Required secrets

The GitHub Actions workflow expects two repository secrets to be configured in your repository settings:

- `FIREBASE_PROJECT` — your Firebase project ID (for example `my-app-12345`).
- `FIREBASE_TOKEN` — a CI token generated from your Firebase account used by `firebase-tools`.

To generate a `FIREBASE_TOKEN` locally run (PowerShell):

```powershell
# from the repository root
cd client
# If you don't have the Firebase CLI installed, use npx to run it without global install
npx firebase login:ci

# The command prints a token you can copy and save as the FIREBASE_TOKEN secret
```

Add the secrets to GitHub:

1. In your repo, go to `Settings` → `Secrets and variables` → `Actions` → `New repository secret`.
2. Create `FIREBASE_PROJECT` and `FIREBASE_TOKEN` with the values above.

Alternatively, you can set repository secrets from the command line with the GitHub CLI:

```powershell
# Example using gh; you will be prompted for values
gh secret set FIREBASE_PROJECT --body "my-firebase-project-id"
gh secret set FIREBASE_TOKEN --body "<your-token-here>"
```

### Deploying locally (manual)

To build and deploy from your machine using the same steps the CI uses:

```powershell
cd client
npm ci
npm run build
# Install firebase-tools if you don't have it globally, or use npx to run it
npx firebase-tools deploy --project "<your-firebase-project-id>" --only hosting
```

Replace `<your-firebase-project-id>` with the value of your Firebase project.

### CI (GitHub Actions)

The workflow `.github/workflows/firebase-deploy-client.yml` triggers on pushes to `main`. Once `FIREBASE_PROJECT` and `FIREBASE_TOKEN` are set in the repository secrets, pushes to `main` will build and deploy the `client` automatically.

This workflow also runs the Playwright E2E suite against the deployed site after a successful deploy. The workflow sets `PLAYWRIGHT_BASE_URL` to the default Firebase hosting domain `https://${{ secrets.FIREBASE_PROJECT }}.web.app` so tests target the live site.

### Backend / API URL (important)

Your client build must know the correct backend API URL at build time. In local development the client defaults to `http://localhost:8000` (see `client/.env`). When you deploy the static site, the built files will contain whatever `VITE_API_URL` value was present at build time — if that value points to `http://localhost:8000`, the hosted site will try to contact your local machine and the browser will fail with `ERR_CONNECTION_REFUSED`.

To avoid the `Failed to fetch` / `ERR_CONNECTION_REFUSED` error in production, provide the production API URL when building. Two options:

- Add a repository secret `VITE_API_URL` (recommended for CI). The deployment workflow uses that secret when building so the deployed site points to the correct API.
- Or create a `client/.env.production` file with `VITE_API_URL=https://api.example.com` before running `npm run build` locally.

Set the `VITE_API_URL` repository secret in GitHub (Settings → Secrets → Actions). The workflow will use that value to build the site.

Example local build (PowerShell) that sets the env for a one-off build:

```powershell
# Replace with your API endpoint
$env:VITE_API_URL = 'https://api.my-backend.example'
cd client
npm ci
npm run build
npx firebase-tools deploy --project "<your-firebase-project-id>" --only hosting
```

If you prefer the CI to use a service-account JSON instead of `VITE_API_URL` as a secret, I can update the workflow to accept and use that instead — tell me which method you prefer.

### Running E2E tests against the hosted site

By default the Playwright E2E config starts a local Vite dev server. To run tests against the deployed Firebase URL you can:

1. Temporarily disable or remove the `webServer` setting in `client/e2e/playwright.config.ts` and set `baseURL` to `https://<your-firebase-hosting-domain>`.
2. Or run Playwright with the `--config` flag pointing to a custom config that sets the `baseURL` and no `webServer`.

Example quick test run against the live site (PowerShell):

```powershell
# set an environment variable for the deployed site and run playwright
$env:PLAYWRIGHT_BASE_URL = 'https://<your-firebase-hosting-domain>'
cd client
npx playwright test
```

Replace `<your-firebase-hosting-domain>` with the domain Firebase assigned to your site (or your custom domain).

If you want, I can also add a small `playwright.config.prod.ts` that points to the deployed URL and disables the `webServer` so CI can run E2E tests after deployment. Would you like me to add that?
