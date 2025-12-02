# Profile Display Name Tasks (Todo)

This document lists follow-up tasks for making display name updates persistent, validated, and surfaced in the UI.

## Summary

We implemented a first-pass flow to update profile display name via `PUT /profile` and store it in the database. This todo list captures next steps to harden, test, and improve this feature.

---

## A) Add backend tests (route + use-case) for the new PUT /profile flow

- Why: Guarantee the route and use-case update the DB, apply validation and authorize the request.
- Scope:
  - Unit test for `UpdateUserProfile` use-case (call repository.update and return updated user)
  - Integration test for `PUT /profile` route:
    - Should return 200 and updated user when valid data is supplied and the request is authenticated
    - Should return 401 for unauthenticated requests
    - Should return 400 for invalid payloads (if validation rule added)
    - Should persist display_name changes to DB
- Relevant files:
  - `server/src/03_adapters/controllers/UserController.ts`
  - `server/src/02_use_cases/UpdateUserProfile.ts`
  - `server/src/03_adapters/repositories/UserRepository.ts`
  - Test paths: `server/src/07_tests/**`
- Acceptance criteria:
  - Tests in `server/src/07_tests` pass in CI and locally
  - New tests cover the main success & failure cases

---

## B) Add input validation and sanitize display name

- Why: Prevent arbitrary or too-long display names, remove leading/trailing whitespace, and protect against XSS/malicious input.
- Scope:
  - Validate `display_name` length (e.g., 1 <= length <= 64)
  - Reject/sanitize characters that are problematic (e.g., control chars, long whitespace, HTML tags)
  - Update controller to return `400` on validation errors with a helpful message
  - Centralize validation in a helper or validation middleware (e.g., Express-validator) so it's reusable
- Relevant files:
  - `server/src/03_adapters/controllers/UserController.ts`
  - `server/src/02_use_cases/UpdateUserProfile.ts`
  - `server/src/05_frameworks/myexpress/jwtAuth.ts` (auth middleware stays the same)
- Acceptance criteria:
  - Backend rejects invalid display_name with 400
  - Tests added to cover validation
  - Display names are stored normalized (trimmed) in DB

---

## C) Add an automatic migration that normalizes display_name values in the DB

- Why: Normalize existing display names in the database (trim, collapse whitespace, remove control chars) to a consistent format.
- Scope:
  - Create a migration script that updates users.display_name for all rows based on normalization rules
  - Optionally convert `display_name` to a consistent case (e.g., preserve capitalization supplied by user, but remove control chars)
- Suggested migration steps:
  - Trim leading/trailing whitespace
  - Replace multiple consecutive whitespace characters with single space
  - Remove null characters
  - Optionally: enforce a maximum length (truncate to 64 chars)
- Relevant files:
  - `server/src/migrations/*` (add a new migration) or `server/src/scripts/normalizeDisplayNames.js` as a one-off migration
- Acceptance criteria:
  - Running migration will transform all existing rows to meet the display name rules
  - Tests / scripts verify a sample before/after

---

## D) Add a small UI "Saved" message in Profile.tsx when the save completes

- Why: Improve UX feedback after updating the display name.
- Scope:
  - Add a non-blocking success message or toast (e.g., a small label near the save button, or a centralized toast)
  - Automatically clear the message after a few seconds
  - Ensure the message is accessible (role=alert) so screen readers announce it
- Relevant files:
  - `client/src/components/pages/Profile.tsx`
  - Optionally: `client/src/components/common/Toast.tsx` (if you prefer a reusable toast component)
- Acceptance criteria:
  - On successful save, the UI shows a short dismissal message (or toast) that disappears after ~3s
  - On error, the existing UI error message shows with helpful text

---

## Implementation notes / Priority

- Priority: A, B, D (High) — tests and validation are the most important; UI feedback improves UX.
- C is Medium priority since it affects existing data and should be done carefully.

---

If you'd like, I can implement each item in order (A → B → D → C) and open PRs for each. Tell me which one to start with or if you'd prefer a different order.
