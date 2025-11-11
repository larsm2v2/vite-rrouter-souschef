# Server CI (server-ci.yml) — notes

This file documents the GitHub Actions workflow at `.github/workflows/server-ci.yml` and the environment it expects.

Summary

- The workflow runs on `ubuntu-latest` using Node.js 20.
- It installs dependencies for both the `server` and the `clean-recipe-service` packages.
-- The workflow builds the TypeScript microservice (with `npx tsc -p .`) and runs the compiled `dist/index.js` on port `6000` before running server tests with `CLEAN_RECIPE_SERVICE_URL` pointing at the running service.

Why ts-node

- Using `ts-node` keeps the workflow simple and matches local developer experience (no build artifacts required).

Required environment / assumptions

- The workflow assumes a Linux runner (Ubuntu); if you run this on Windows runners the process background/kill commands will differ.
- Node 20 is selected by the workflow. Adjust `node-version` in the workflow if you need a different Node version.
- The server tests rely on `CLEAN_RECIPE_SERVICE_URL` being set to `http://127.0.0.1:6000` (this is set by the workflow before running tests).

Local reproduction

1. From the repository root, install dependencies:

```bash
# server dependencies
cd server && npm ci

# microservice dependencies (devDependencies include ts-node + typescript)
# The CI workflow uses `npm ci` for deterministic installs now that `package-lock.json` is up to date.
# Locally run `npm ci` after pulling the updated lockfile.
cd ../clean-recipe-service && npm ci
```

2. Start the microservice locally (build + run compiled JS):

```bash
cd clean-recipe-service
# build
npx tsc -p .
# run compiled output
PORT=6000 node dist/index.js
```

3. Run server tests using the running microservice:

```bash
cd ../server
export CLEAN_RECIPE_SERVICE_URL="http://127.0.0.1:6000"
npm test
```

Notes

Note: The workflow now compiles the microservice and runs the compiled `dist/index.js`. This is recommended for CI and production flows. `ts-node` is still useful for local development.
- For Windows runners, set the `PORT` environment variable and start the service with a Windows-friendly background process (PowerShell `Start-Process`) and adjust the health-check loop accordingly.

Note: `ts-node` and `typescript` are included in `clean-recipe-service/devDependencies` so `npm ci` will install them for CI runs.
