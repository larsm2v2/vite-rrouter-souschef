# Server API Documentation (summary)

This document provides a brief, high-level reference for the server and the clean-recipe microservice endpoints used by the application. It is intended as an index and quick examples — expand with full request/response schemas if you need formal API docs (OpenAPI/Swagger).

## Common notes

- Content-Type: application/json for JSON payloads.
- Authentication: endpoints marked "(auth)" require an authenticated user (see `server/docs/DEVELOPMENT.md` for auth notes).

---

## POST /clean-recipe (clean-recipe-service)

Description: Normalizes and sanitizes a recipe payload. The server uses the microservice when `CLEAN_RECIPE_SERVICE_URL` is set; otherwise a local cleaner is used as fallback.

Request example:

```json
POST /clean-recipe
Content-Type: application/json

{
  "name": "Roast Chicken",
  "ingredients": ["1 whole chicken", "salt", "pepper"],
  "instructions": "Roast at 375F for 1 hour"
}
```

Response example (200):

```json
{
  "name": "Roast Chicken",
  "slug": "roast-chicken",
  "uniqueId": "abc123",
  "ingredients": ["1 whole chicken", "salt", "pepper"],
  "instructions": [
    { "stepNumber": 1, "text": "Preheat oven to 375°F" },
    { "stepNumber": 2, "text": "Roast until done" }
  ],
  "servingInfo": { "servings": 4 }
}
```

Errors:

- 400 Bad Request — malformed JSON or missing required fields
- 500 Internal Server Error — unexpected error in microservice or local cleaner

---

## Server endpoints (examples)

These are the core endpoints the server exposes; adapt paths to your routes if they differ.

- POST /recipes — Create a new recipe (auth)

  - Request body: recipe object (the server will clean the recipe via the cleaner/microservice)
  - Response: created recipe (201)

- GET /recipes/:id — Get recipe by id (public)

- PUT /recipes/:id — Update recipe (auth)

- DELETE /recipes/:id — Delete recipe (auth)

- GET /profile — Get current user profile (auth)

- POST /auth/login — Login endpoint (if present)

For full request/response shapes, generate OpenAPI from TypeScript types or expand this document per endpoint.

---

## Notes for integrators

- The cleaning contract should be stable: keys like `uniqueId`, `slug`, `servingInfo`, and `instructions.stepNumber` are expected by the server. If you change the cleaner's output shape, update the server and tests at the same time.
- Use `CLEAN_RECIPE_SERVICE_URL` to point the server at an externally hosted microservice. If unset, the server uses an internal cleaner implementation.
