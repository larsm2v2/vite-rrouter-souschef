# Types entities comparison report

Generated: 2025-11-15

Purpose: compare `server/src/types/entities` vs `server/src/01_entities` (read-only) and list:

- Files existing in both places
- Properties/types present in `src/types/entities` but missing/different in `01_entities`
- Type-only declarations in `src/types/entities` not present in `01_entities`

---

## Inventory

server/src/types/entities:

- GoogleProfile.ts (type-only)
- User.ts (type + EntitySchema)

server/src/01_entities:

- AuditLog.ts
- GroceryItem.ts
- index.ts
- MealPlan.ts
- Recipe.ts
- RecipeActivityLog.ts
- ShoppingListVersion.ts
- User.ts

Summary:

- Files present in both locations: `User.ts`.
- Files present only in `src/types/entities`: `GoogleProfile.ts`.
- Files present only in `src/01_entities`: `AuditLog.ts`, `GroceryItem.ts`, `MealPlan.ts`, `Recipe.ts`, `RecipeActivityLog.ts`, `ShoppingListVersion.ts`, plus `index.ts`.

---

## Detailed differences: `User.ts`

Source: `server/src/types/entities/User.ts` (abridged)

```ts
export interface User {
  id: number;
  googleSub?: string;
  email: string;
  display_name: string;
  avatar?: string;
}
```

Source: `server/src/01_entities/User.ts` (abridged)

```ts
export interface User {
  id: number;
  googleSub?: string;
  email: string;
  displayName: string;
  avatar?: string;
  // additional fields
  dietaryPreferences?: string[];
  favoriteCuisines?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
```

Notes on differences:

- Property name mismatch:

  - `src/types/entities/User.ts` uses `display_name` (snake_case).
  - `src/01_entities/User.ts` uses `displayName` (camelCase).
  - The rest of the codebase (SQL strings and route handlers) references `display_name` extensively (see examples below), so this naming mismatch is important.

- Extra fields in `01_entities` not present in `types/entities`:

  - `dietaryPreferences?: string[]`
  - `favoriteCuisines?: string[]`
  - `createdAt?: Date`
  - `updatedAt?: Date`

- EntitySchema differences reflect the naming difference (columns: `display_name` vs `displayName`). That has runtime implications for DB column names and SQL queries.

Examples of code referencing `display_name` (non-exhaustive):

- `server/src/05_frameworks/auth/passport.ts` — SELECT / mapping uses `display_name`.
- `server/src/05_frameworks/myexpress/routes/auth.routes.ts` — request handlers, INSERT statements use `display_name`.
- `server/src/05_frameworks/myexpress/routes/auth-google-pkce.routes.ts` — SELECT and mapping use `display_name`.
- `server/src/utils/jwt.ts` — JWT payload includes `display_name`.
- `server/src/types/express.d.ts` — Express.User augmentation contains `display_name`.
- Tests under `server/src/07_tests` insert/select `display_name` in SQL fixtures.

Implication: switching `User` property names in types or entities _without_ reconciling code and DB schema will create type/SQL mismatches and runtime errors.

---

## Type-only declarations present only in `src/types/entities`

- `GoogleProfile.ts` — defines:

```ts
export interface GoogleProfile {
  id: string;
  display_name: string;
  emails: { value: string; verified: boolean }[];
}
```

- This type is used by the OAuth/PKCE code paths (PKCE routes / user creation). There is no equivalent `GoogleProfile` interface in `src/01_entities`.

Recommendation: add `GoogleProfile` (or equivalent) to `src/01_entities` as a type-only export so code can be rewired to import it from the canonical place.

---

## Actionable recommendations (next steps)

1. Reconcile `display_name` vs `displayName`:

   - Option A (conservative): Keep DB column names as `display_name` (no DB migration). In `01_entities/User.ts` add a type alias or additional property to reflect the snake_case name for consumers that use `display_name`.
     - e.g., export an interface `UserRecord` that has `display_name: string` and map runtime entity fields explicitly in repositories.
   - Option B (modernize): Migrate codebase to `displayName` (camelCase) and update SQL, schema, and tests accordingly. This is higher-risk and requires DB migration or aliasing columns via EntitySchema column naming options.
   - Choose based on how much work you're willing to do now. For minimal churn, prefer Option A.

2. Add `GoogleProfile` to `src/01_entities` as a type-only interface and re-export it.

3. Update consuming modules to import types from `01_entities` (use `import type`) in small batches and run `npm run build` after each batch.

4. Consider adding a small mapping utility in `01_entities` (or repositories layer) to convert between DB row shape (`display_name`) and domain object shape (`displayName`) so both naming styles are supported during migration.

---

## Appendix: files read

- `server/src/types/entities/User.ts` (full file read)
- `server/src/types/entities/GoogleProfile.ts` (full file read)
- `server/src/01_entities/User.ts` (full file read)

---

If you want, I can now:

- Create skeleton types in `server/src/01_entities` for `GoogleProfile` and a `UserRecord` alias to represent the DB shape (non-destructive), or
- Start rewiring a small batch of files to import types from `01_entities` (type-only `import type`) and run `npm run build` after the batch.

Which do you want me to do next?
