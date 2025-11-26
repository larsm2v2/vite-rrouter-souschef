# Rewire types into `01_entities`

Last updated: 2025-11-15

This document records the plan to consolidate type/entity definitions into `server/src/01_entities` and migrate dependent code to import types from that location.

## Goal

- Make `server/src/01_entities/*` the canonical source of entity types used across the server codebase.
- Move or duplicate type definitions currently in `server/src/types/entities/*` into `01_entities` (type-only first), then rewire imports to the new locations.
- Preserve runtime behavior during the migration (use `import type` where possible).

## Why

- Reduces duplication between runtime entity implementations and separate `types` folder.
- Keeps domain models and their TypeScript type contracts co-located with implementation.
- Simplifies maintenance and documentation (single source of truth).

## High-level approach (safe, incremental)

1. Inventory & compare (read-only)

   - Compare files in `server/src/types/entities` vs `server/src/01_entities` and produce a report listing:
     - Files existing in both places
     - Properties/types present in `src/types/entities` but missing/different in `01_entities`
     - Type-only declarations in `src/types/entities` not present in `01_entities`
   - No source edits in this step.

2. Add missing types into `01_entities` (type-only)

   - For each missing type/property, add an exported interface/type in the matching `01_entities/*` file or in a new `01_entities/types.ts` helper.
   - Keep these additions type-only (`export interface` / `export type`) to avoid runtime changes.
   - Re-export types from `server/src/01_entities/index.ts` to provide a single import surface if useful.

3. Rewire imports across the codebase in small batches

   - Replace imports referencing `src/types/entities/*` with imports from `src/01_entities/*`.
   - Prefer `import type { X } from "../../01_entities/X";` so TypeScript removes type-only imports at compile time and avoids runtime side effects.
   - Work in small, reviewable batches (e.g., 10 files per commit) and run `npm run build` after each batch.

4. Validate and iterate

   - After each batch, run the TypeScript build and any available tests.
   - Fix missing symbols by adding small exports in `01_entities` or updating imports.

5. Cleanup
   - Once everything imports from `01_entities` and the build is clean, either:
     - Delete `server/src/types/entities`, or
     - Convert it into a compatibility shim that re-exports types from `01_entities` for a transition period.
   - Update `server/tsconfig.json` `typeRoots` only if you want `01_entities` scanned automatically (not required if code imports explicitly).
   - Update repo docs (`docs/file-mapping.md`) to indicate `01_entities` as canonical.

## Concrete commands and checks

- Quick file lists and diff samples:

```pwsh
# from repo root
ls server/src/types/entities -File
ls server/src/01_entities -File

git --no-pager diff --no-index -- server/src/types/entities/User.ts server/src/01_entities/User.ts | sed -n '1,200p'
```

- Build/test after each batch:

```pwsh
# from server folder
npm run build
npm test # if tests exist
```

- Revert commit if needed:

```pwsh
git reset --hard HEAD~1
```

## Mapping and heuristics

- Priority files to migrate first (auth-sensitive):

  1. `User` / auth-related DTOs (used by JWT and auth routes)
  2. Google profile type (`GoogleProfile`) used by PKCE route
  3. Any shared DTOs used across many routes (recipe, grocery, shopping list)

- Use `import type` when a module only needs types:

```ts
import type { UserType } from "../../01_entities/User";
```

- If code requires runtime behavior from `01_entities` (e.g., constructors, helper functions), keep a normal import for those values and use `import type` only for type references.

## Edge cases and risk mitigation

- Some types in `src/types/entities` may be broader or narrower than runtime shapes in `01_entities`. Verify optional vs nullable fields carefully.
- Avoid introducing circular runtime imports. Keep type-only files free of runtime dependencies where possible.
- Work in small batches to reduce blast radius; run the TypeScript build after each batch.

## Moving global declaration files (`express.d.ts`, `express-session.d.ts`)

Rationale

- `express.d.ts` and `express-session.d.ts` provide ambient type augmentations used across the server. They belong with framework-level code rather than ad-hoc `types` folders.
- We want a predictable, numbered folder layout (prefixes `01_`..`07_`) so developers can find framework and infra files quickly.

Recommended target location

- Place the declaration files under a framework-scoped folder using the existing numbering scheme. Two options:
  - `server/src/05_frameworks/types/` — keeps framework and middleware types with other framework code.
  - `server/src/07_infra/types/` — if you prefer infra/ops-facing types in the higher-numbered area.

I recommend `server/src/05_frameworks/types/` because these declarations augment Express (a framework-level dependency) and are closely tied to middleware and routing code.

Migration steps (safe, reversible)

1. Create the target folder and copy files

   - `mkdir -p server/src/05_frameworks/types` and copy both `express.d.ts` and `express-session.d.ts` into it.
   - Do not delete the originals yet.

1. Update `server/tsconfig.json`
   - Add or adjust `typeRoots` to include the new folder in addition to `./src/types`:

```json
"typeRoots": ["./node_modules/@types", "./src/types", "./src/05_frameworks/types"]
```

1. Build and verify

   - Run `npm run build` from `server` to confirm TypeScript picks up the declarations and no ambient type collisions occur.

1. Switch consumers (optional, mostly automatic)

   - Because these are ambient declarations, most code will pick them up automatically once `typeRoots` is updated. If any modules import the old files explicitly, update those imports to the new path or replace them with `import "../05_frameworks/types/express";` style side-effect import if required.

1. Replace originals with a compatibility shim (recommended)
   - Leave the original files in `server/src/types/` but convert them to re-export the new location to avoid breaking in-progress branches:

```ts
// server/src/types/express.d.ts
export * from "../05_frameworks/types/express";
```

Ambient declaration files cannot be `export`-only; if a shim is required, keep a short duplicate that points developers to the canonical location and add a comment.

1. Final cleanup
   - Once CI and builds are stable for several commits, delete the old files and remove the shim.

Notes and caveats

- Because these files are ambient/global, moving them relies on `tsconfig` changes rather than changing imports in application files.
- Keep the new folder minimal and focused: only ambient augmentation files and framework-scoped type helpers live there.
- Document the new location in `docs/file-mapping.md` and this `types-rewire-plan.md` so contributors know where to add future framework-level type declarations.

## Rollback plan

- Use small commits and branch off `main` for the whole migration:

```pwsh
git checkout -b feat/rewire-types
# make a small batch of edits and commit
# if build fails or regressions appear:
git reset --hard HEAD~1
```

- If you accidentally remove many files, you can restore from the previous branch or commit.

## Quality gates

- Required: `npm run build` (TypeScript compile must succeed).
- Recommended: run tests (`npm test`) and linting.

## Deliverables I can produce

- A comparison report listing per-file differences (text diffs + missing props list).
- A type-only patch that adds missing interfaces to `server/src/01_entities`.
- A small batch of import rewires with a passing TypeScript build.
- Final cleanup commit or compatibility shim.

## Estimated effort

- Produce comparison report: ~10–20 minutes.
- Add skeleton types + rewire first batch (10–20 files): ~30–60 minutes.
- Full repo migration (safe, incremental): 2–4 hours depending on number of consumer files and test coverage.

## Next steps (pick one)

- Option A (recommended): Run the comparison report now. I will produce a file showing per-file diffs and missing properties.
- Option B: I can create skeleton types for `User` and `GoogleProfile` in `server/src/01_entities` and prepare the first batch of rewires.
- Option C: Pause and review the plan offline.

---

Document created by automation — please review the priority list and tell me which option to execute next.
