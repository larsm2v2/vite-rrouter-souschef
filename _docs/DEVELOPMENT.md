# Development Guide

This short guide explains the development workflow, how to add features, testing strategy, and coding conventions for the server codebase.

## Code organization

- The project follows a Clean Architecture layout under `server/src/` with layers:
  - 01_entities — core domain entities
  - 02_use_cases — application use cases (business logic)
  - 03_adapters — controllers & repositories
  - 04_factories — wire up use-cases and adapters
  - 05_frameworks — framework code (database connection, express app)
  - 06_app — app entry and bootstrap
  - 07_tests — tests organized by layer

## Adding a new feature

1. Add or update the domain `Entity` in `01_entities` (if needed).
2. Implement the use case in `02_use_cases` (pure logic).
3. Add adapters (controller, repository) to `03_adapters`.
4. Add a factory in `04_factories` to wire dependencies.
5. Expose the feature via a route in `05_frameworks/myexpress/routes` and a controller under `03_adapters/controllers`.
6. Add tests in `07_tests` (unit tests for use-cases, integration tests for controllers/adapters).

## Testing strategy

- Unit tests: put alongside `02_use_cases` in `07_tests/02_use_cases`.
- Integration tests: exercises multiple layers (e.g., controller → use case → repository) in `07_tests`.
- End-to-end: if you want full E2E, run the built microservice and the server locally or in CI.

Run tests locally:

```powershell
# from repository root
cd server
npm ci
npm test
```

To exercise the microservice path when running tests, start the microservice in a separate terminal and set `CLEAN_RECIPE_SERVICE_URL` to its address before running tests (see `server/docs/DEPLOYMENT.md` and `server/docs/API.md` for details).

## Coding conventions

- Language: TypeScript.
- Keep business logic in `02_use_cases` and avoid framework concerns there.
- Use small, single-responsibility functions; prefer pure functions in use-case code.
- Tests: prefer deterministic tests — mock external services where appropriate.

## Branching & PRs

- Create a branch per task: `cleanup/<topic>` or `feature/<short-description>`.
- Include unit tests for new logic and update integration tests where contracts change.
- Run `npm test` in `server` before opening a PR.

## Linting and formatting

- Run the project's linters and formatters (if present). If a linter/formatter isn't configured, follow the repository's existing style.
