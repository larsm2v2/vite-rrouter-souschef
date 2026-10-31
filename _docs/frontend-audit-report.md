# Frontend Audit Handoff

**Date:** 2026-10-31  
**Scope:** React/Vite client, auth and recipe flows, grocery sidebar, URL import, lint/build, Playwright desktop and mobile Chromium, Node runtime migration.  
**Disposition:** All actionable findings discovered in this pass were fixed. Three non-blocking lint warnings, untested Firefox/WebKit browsers, and one incomplete full Docker image build remain.

## Findings

| ID    | Severity         | Finding                                                                                                                                                                                                                                         | Status                                                                                                                                                                                                                                                             |
| ----- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FE-01 | High             | `MainLayout` initialized selected recipe IDs as empty, then an effect wrote that empty value to local storage before hydration completed. Strict Mode could erase the user's persisted selection on reload.                                     | Fixed by synchronously validating/hydrating the state initializer in [MainLayout.tsx](../client/src/components/layout/MainLayout.tsx).                                                                                                                             |
| FE-02 | High             | `GroceryList` re-added every selected recipe's ingredients to the already-persisted grocery list on reload. Playwright reproduced a saved quantity of 3 becoming 6. The effect also captured stale list state.                                  | Fixed to process newly selected recipe IDs only after hydration and merge with functional state updates in [GroceryList.tsx](../client/src/components/GroceryList/GroceryList.tsx). Regression test added.                                                         |
| FE-03 | Medium           | Grocery edit/delete/done actions were clickable spans without button semantics, keyboard activation, focus indication, or accessible names.                                                                                                     | Fixed with labeled buttons and focus styling in [SingleListItem.tsx](../client/src/components/GroceryList/SingleListItem/SingleListItem.tsx) and [InputField.css](../client/src/components/GroceryList/InputField/InputField.css). Keyboard regression test added. |
| FE-04 | High             | Browser console diagnostics printed OAuth PKCE state and session storage contents; refresh diagnostics printed the access-token response body. Auth errors also dumped Axios objects/headers, and recipe/OCR flows logged private user content. | Fixed by removing payload diagnostics or logging only fixed labels, status codes, and sanitized messages across auth, profile, recipe, grocery, image, and OCR paths.                                                                                              |
| FE-05 | Medium           | Protected-route return state was held only in React Router state, which does not survive the full-page Google OAuth round trip.                                                                                                                 | Fixed by persisting a validated same-origin route in session storage and using a stable post-login target in [Login.tsx](../client/src/components/pages/Login.tsx). Local login and OAuth-fragment callback flows are covered by Playwright.                       |
| FE-06 | Medium           | Client lint had errors for a `.js` file containing JSX, explicit `any` in OCR/API request code, and unused/redundant catch handling.                                                                                                            | Fixed: removed the unreferenced malformed `ChefHat-original.js`, typed API request results, and replaced unsafe OCR casts.                                                                                                                                         |
| FE-07 | Feature          | Grocery list had no direct export for Google Keep.                                                                                                                                                                                              | Implemented “Copy for Google Keep” for unchecked items with normalized one-item-per-line text and toast feedback. Covered by Playwright.                                                                                                                           |
| FE-08 | Feature          | No protected shared-recipe preview/accept journey existed in the client.                                                                                                                                                                        | Implemented share action, preview route, login return handling, and accept flow; API responses use the client `RecipeModel` shape. Covered with stubbed API responses in Playwright.                                                                               |
| FE-09 | Feature/Security | OCR import had no URL source, and no server-side public-HTML fetch/JSON-LD parser existed.                                                                                                                                                      | Implemented the URL tab, reusable editable recipe preview, authenticated/rate-limited endpoint, schema.org Recipe parser, DNS pinning, private-IP rejection, redirect revalidation, 8-second deadline, 3 MiB cap, and focused tests.                               |

| FE-10 | High | PKCE used the frontend callback while the server exchange could use the legacy API `GOOGLE_CALLBACK_URL`, causing a redirect URI mismatch. | Fixed by separating `GOOGLE_PKCE_REDIRECT_URI` and `VITE_GOOGLE_PKCE_REDIRECT_URI`, and rejecting exchange URI mismatches. The exact frontend callback still must be registered in Google Cloud Console. |

## Remaining Items

- `npm run lint` reports three non-blocking Fast Refresh warnings in `Models.tsx`, `Toast.tsx`, and `AuthContext.tsx`.
- Playwright was run on desktop Chromium and Mobile Chrome. Firefox and WebKit were not run because their pinned browser binaries are not installed. The initial all-project run failed at browser launch, before application assertions; Chromium was installed in the user cache only.
- The new sharing tests stub backend responses; server-side sharing behavior is separately covered by the server build/test run from the backend phase. A live client-to-server browser integration was not run in this pass.
- The clean-recipe-service Dockerfile now uses deterministic `npm ci`, a strict TypeScript build, and runtime-only OS libraries. Its Node 24 image builds and a container smoke test confirms Sharp 0.32.6 loads. The server Node 24 Docker image also builds and runs.
- Docker image diagnostics report 15 high findings on the Node server base and 14 on the clean-recipe base; scan/patch work is separate from the Node runtime migration.
- Firefox/WebKit and a dedicated live client-to-server URL-import browser test remain follow-up coverage.

## Runtime Upgrade

- Runtime pins are aligned on Node 24: `.nvmrc`, all three package `engines`, both service Dockerfiles, and client/server/Playwright GitHub Actions workflows.
- Server `@types/node` now targets v24. The deployment-guide Docker sample and server workflow guide were updated.
- Verified with Node 24.22.2: server build and tests; client build and lint; clean-recipe-service build and tests; Sharp load; desktop/mobile Chromium E2E.

## Verification

- Client `npm run lint`: zero errors, three warnings.
- Client `npm run build`: passed.
- Playwright projects `chromium` and `Mobile Chrome`: **64 passed, 4 skipped** across the current suite under Node 24.
- Server: build passed; **19/19 suites, 68/68 tests passed** under Node 24.
- Clean-recipe-service: TypeScript build and **12/12 tests passed** under Node 24; Sharp 0.32.6 loaded successfully.
- Docker: server image built and reports Node 24.22.2; optimized clean-recipe image built and reports Node 24.22.2 with Sharp 0.32.6.
- Focused grocery export, persisted-selection, keyboard action, share-preview/accept, OAuth callback, PKCE, and URL-import editor tests pass.
- URL import parser/controller tests cover structured recipe normalization, unsafe URL rejection, and API response shape.
- Playwright output was directed to the system temp directory; no traces/screenshots were added to the repository.

## Files Added or Changed In This Audit

- Grocery export: [GroceryList.tsx](../client/src/components/GroceryList/GroceryList.tsx), [GroceryList.css](../client/src/components/GroceryList/GroceryList.css)
- Grocery keyboard controls: [SingleListItem.tsx](../client/src/components/GroceryList/SingleListItem/SingleListItem.tsx), [InputField.css](../client/src/components/GroceryList/InputField/InputField.css)
- Login return routing: [Login.tsx](../client/src/components/pages/Login.tsx)
- Browser coverage: [grocery-copy-to-keep.spec.ts](../client/e2e/tests/grocery-copy-to-keep.spec.ts), [recipe-share.spec.ts](../client/e2e/tests/recipe-share.spec.ts)
- URL import coverage: [url-import.spec.ts](../client/e2e/tests/url-import.spec.ts), server parser/controller and safe-fetch tests.
- Sensitive logging and lint cleanup: client auth, profile, recipe, OCR, grocery, and API request modules.
