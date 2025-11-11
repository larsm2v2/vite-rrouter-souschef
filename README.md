# SousChef Repository (overview)

This repository contains two main pieces:

- `server/` — the SousChef server (TypeScript, Clean Architecture layout)
- `clean-recipe-service/` — optional microservice that normalizes/cleans recipe payloads
- `client/` — frontend app (Vite + React/TypeScript)

See `server/docs/` for more details:

- `server/docs/API.md` — quick API reference and examples
- `server/docs/DEPLOYMENT.md` — environment variables and deployment notes
- `server/docs/DEVELOPMENT.md` — development guide and testing instructions

Quick start (developer):

1. Install dependencies for server and microservice

```powershell
# from repo root
cd server
npm ci

cd ..\clean-recipe-service
npm install
```

2. (Optional) Start microservice with ts-node for development

```powershell
cd clean-recipe-service
$env:PORT = "6000"
npx ts-node --transpile-only src/index.ts
```

3. Start server (in a separate shell). To exercise the microservice path, set the env var first:

```powershell
$env:CLEAN_RECIPE_SERVICE_URL = 'http://127.0.0.1:6000'
cd server
npm run dev
```

Testing

Run server tests (unit + integration):

```powershell
cd server
npm test
```

Contributing

Follow the Clean Architecture layout. Create a branch per feature or cleanup task. Run tests locally and include test coverage for new behavior.
