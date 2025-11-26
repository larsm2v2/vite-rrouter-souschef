# Server File Mapping & Status

**Date:** November 10, 2025  
**Project:** SousChef Recipe Application

This document provides a complete inventory of all server files with their status, purpose, and recommendations.

---

## Legend

- ✅ **KEEP** - File follows Clean Architecture and is needed
- 🔄 **MIGRATE** - File needs to be moved to proper location
- ❌ **DELETE** - File is duplicate, legacy, or unused
- ⚠️ **REVIEW** - Needs investigation before decision
- 📝 **UPDATE** - Needs content updates but keep file

---

## Root Level Files

| File                      | Status    | Recommendation                                                | Notes                 |
| ------------------------- | --------- | ------------------------------------------------------------- | --------------------- |
| `server.ts`               | ❌ DELETE | Superseded by `src/06_app/server.ts` and `src/06_app/main.ts` | Legacy entry point    |
| `Structure.txt`           | ❌ DELETE | Documentation moved to `docs/` folder                         | Outdated              |
| `Recipes.json`            | ✅ MOVED  | Now at `server/data/Recipes.json`                             | Static seed/reference |
| `IngredientSynonyms.json` | ✅ MOVED  | Now at `server/data/IngredientSynonyms.json`                  | Static mapping data   |
| `package.json`            | ✅ KEEP   | -                                                             | Project dependencies  |
| `tsconfig.json`           | ✅ KEEP   | -                                                             | TypeScript config     |
| `jest.config.ts`          | ✅ KEEP   | -                                                             | Jest config           |
| `jest.setup.ts`           | ✅ KEEP   | -                                                             | Jest setup            |
| `jest.global-setup.ts`    | ✅ KEEP   | -                                                             | Test lifecycle        |
| `jest.global-teardown.ts` | ✅ KEEP   | -                                                             | Test lifecycle        |
| `cloudbuild.yaml`         | ✅ KEEP   | -                                                             | CI/CD config          |

---

## src/ Directory

### 01_entities/ ✅

| File             | Status  | Notes         |
| ---------------- | ------- | ------------- |
| `User.ts`        | ✅ KEEP | Domain entity |
| `Recipe.ts`      | ✅ KEEP | Domain entity |
| `GroceryItem.ts` | ✅ KEEP | Domain entity |
| `AuditLog.ts`    | ✅ KEEP | Domain entity |
| `index.ts`       | ✅ KEEP | Barrel export |

**Status:** Complete and properly structured ✅

---

### 02_use_cases/ ✅

| File                     | Status  | Notes         |
| ------------------------ | ------- | ------------- |
| `CreateRecipe.ts`        | ✅ KEEP | Use case      |
| `UpdateRecipe.ts`        | ✅ KEEP | Use case      |
| `DeleteRecipe.ts`        | ✅ KEEP | Use case      |
| `GetUserProfile.ts`      | ✅ KEEP | Use case      |
| `GetGroceryList.ts`      | ✅ KEEP | Use case      |
| `CheckAuthentication.ts` | ✅ KEEP | Use case      |
| `LogoutUser.ts`          | ✅ KEEP | Use case      |
| `AuditLogging.ts`        | ✅ KEEP | Use case      |
| `index.ts`               | ✅ KEEP | Barrel export |

**Status:** Complete and properly structured ✅

---

### 03_adapters/ ⚠️

#### repositories/ ✅

| File                   | Status  | Notes            |
| ---------------------- | ------- | ---------------- |
| `UserRepository.ts`    | ✅ KEEP | Database adapter |
| `RecipeRepository.ts`  | ✅ KEEP | Database adapter |
| `GroceryRepository.ts` | ✅ KEEP | Database adapter |

**Status:** Complete ✅

#### controllers/ ⚠️

**Status:** Needs investigation - controllers may be in routes or scattered

**Action Required:**

- Identify all controllers
- Move to `03_adapters/controllers/`
- Ensure separation from routes

---

### 04_factories/ ✅

| File                            | Status  | Notes         |
| ------------------------------- | ------- | ------------- |
| `CheckAuthenticationFactory.ts` | ✅ KEEP | DI factory    |
| `GetUserProfileFactory.ts`      | ✅ KEEP | DI factory    |
| `LogAuditFactory.ts`            | ✅ KEEP | DI factory    |
| `LogoutUserFactory.ts`          | ✅ KEEP | DI factory    |
| `index.ts`                      | ✅ KEEP | Barrel export |

**Missing Factories (to create):**

- `CreateRecipeFactory.ts`
- `UpdateRecipeFactory.ts`
- `DeleteRecipeFactory.ts`
- `GetGroceryListFactory.ts`

**Status:** Incomplete - needs additional factories ⚠️

---

### 05_frameworks/ 📝

#### auth/ ✅

| File          | Status  | Location              | Notes           |
| ------------- | ------- | --------------------- | --------------- |
| `passport.ts` | ✅ KEEP | `05_frameworks/auth/` | Passport config |
| `sessions.ts` | ✅ KEEP | `05_frameworks/auth/` | Session config  |

#### database/ ✅

| File            | Status    | Location                  | Notes                                 |
| --------------- | --------- | ------------------------- | ------------------------------------- |
| `connection.ts` | ✅ KEEP   | `05_frameworks/database/` | Pool management                       |
| `schema.ts`     | ⚠️ REVIEW | `05_frameworks/database/` | Should be here, check actual location |

#### myexpress/ ✅

| File            | Status    | Location                          | Notes             |
| --------------- | --------- | --------------------------------- | ----------------- |
| `app.ts`        | ✅ KEEP   | `05_frameworks/myexpress/`        | Express app       |
| `middleware.ts` | ✅ KEEP   | `05_frameworks/myexpress/`        | Custom middleware |
| `routes/`       | ⚠️ REVIEW | `05_frameworks/myexpress/routes/` | Check if complete |

**Status:** Mostly organized, needs verification ⚠️

---

### 06_app/ ✅

| File             | Status  | Notes                   |
| ---------------- | ------- | ----------------------- |
| `main.ts`        | ✅ KEEP | Application entry point |
| `server.ts`      | ✅ KEEP | Server startup logic    |
| `database.ts`    | ✅ KEEP | Database initialization |
| `environment.ts` | ✅ KEEP | Environment validation  |
| `index.ts`       | ✅ KEEP | Barrel export           |

**Status:** Complete and properly structured ✅

---

### 07_tests/ ⚠️

#### Current Structure

| Folder           | Status     | Notes                            |
| ---------------- | ---------- | -------------------------------- |
| `01_entities/`   | ✅ KEEP    | Entity tests complete            |
| `02_use_cases/`  | ❌ EMPTY   | Need to write tests              |
| `03_adapters/`   | ❌ EMPTY   | Need to write tests              |
| `04_factories/`  | ❌ EMPTY   | Need to write tests              |
| `05_frameworks/` | ❌ EMPTY   | Need to write tests              |
| `06_app/`        | ⚠️ PARTIAL | `app.test.ts` exists, needs more |

**Status:** Incomplete - majority of tests missing ⚠️

---

### Legacy Folders (Need Migration/Deletion)

#### config/ 🔄

| File             | Status     | Current Location   | Target Location                                   |
| ---------------- | ---------- | ------------------ | ------------------------------------------------- |
| `database.ts`    | 🔄 MIGRATE | `src/config/`      | `src/05_frameworks/database/connection.ts`        |
| `schema.ts`      | 🔄 MIGRATE | `src/config/`      | `src/05_frameworks/database/schema.ts`            |
| `test-config.ts` | ⚠️ REVIEW  | `src/config/`      | `src/07_tests/test-config.ts` or merge into setup |
| `auth/`          | 🔄 MIGRATE | `src/config/auth/` | `src/05_frameworks/auth/`                         |

**Action:** Migrate all files, then delete `config/` folder

---

#### routes/ 🔄

| File                | Status     | Current Location | Target Location                       |
| ------------------- | ---------- | ---------------- | ------------------------------------- |
| `auth.routes.ts`    | 🔄 MIGRATE | `src/routes/`    | `src/05_frameworks/myexpress/routes/` |
| `grocery.routes.ts` | 🔄 MIGRATE | `src/routes/`    | `src/05_frameworks/myexpress/routes/` |
| `recipes.routes.ts` | 🔄 MIGRATE | `src/routes/`    | `src/05_frameworks/myexpress/routes/` |
| `profile.ts`        | 🔄 MIGRATE | `src/routes/`    | `src/05_frameworks/myexpress/routes/` |
| `index.ts`          | 🔄 MIGRATE | `src/routes/`    | `src/05_frameworks/myexpress/routes/` |

**Action:** Migrate all files, then delete `routes/` folder

---

#### middleware/ 🔄

| File           | Status     | Current Location  | Target Location                                        |
| -------------- | ---------- | ----------------- | ------------------------------------------------------ |
| `rateLimit.ts` | 🔄 MIGRATE | `src/middleware/` | Merge into `src/05_frameworks/myexpress/middleware.ts` |

**Action:** Migrate logic, then delete `middleware/` folder

---

#### services/ ❌

| File                | Status    | Recommendation                            | Notes                |
| ------------------- | --------- | ----------------------------------------- | -------------------- |
| `recipe.service.ts` | ❌ DELETE | Logic moved to use cases and repositories | Legacy service layer |

**Action:** Delete entire `services/` folder

---

#### tests/ (old location) 🔄

| File               | Status     | Current Location | Target Location                                        |
| ------------------ | ---------- | ---------------- | ------------------------------------------------------ |
| `auth.test.ts`     | 🔄 MIGRATE | `src/tests/`     | `src/07_tests/05_frameworks/auth/auth.test.ts`         |
| `database.test.ts` | 🔄 MIGRATE | `src/tests/`     | `src/07_tests/05_frameworks/database/database.test.ts` |
| `db.test.ts`       | 🔄 MIGRATE | `src/tests/`     | Merge with database.test.ts                            |
| `profile.test.ts`  | 🔄 MIGRATE | `src/tests/`     | `src/07_tests/03_adapters/controllers/profile.test.ts` |
| `test-utils.ts`    | 🔄 MIGRATE | `src/tests/`     | `src/07_tests/test-utils.ts`                           |

**Action:** Migrate all files, then delete `tests/` folder

---

#### migrations/ ✅

| File                      | Status  | Notes              |
| ------------------------- | ------- | ------------------ |
| `create_recipe_tables.ts` | ✅ KEEP | Database migration |

**Status:** Keep in current location or move to `05_frameworks/database/migrations/`

---

### types/ ✅

| File                        | Status    | Notes                              |
| --------------------------- | --------- | ---------------------------------- |
| `express-session.d.ts`      | ✅ KEEP   | Type augmentation                  |
| `express.d.ts`              | ✅ KEEP   | Type augmentation                  |
| `passport-google-oidc.d.ts` | ✅ KEEP   | Type definitions                   |
| `entities/`                 | ⚠️ REVIEW | May be duplicate of `01_entities/` |

**Action:** Review `entities/` subfolder - may need to delete if duplicate

---

### utils/ ✅

| File             | Status    | Notes                               |
| ---------------- | --------- | ----------------------------------- |
| `crypto.ts`      | ✅ KEEP   | Encryption utilities                |
| `cleanRecipe.ts` | ⚠️ REVIEW | Check if using microservice instead |

---

## docs/ ✅

| File                         | Status  | Notes                 |
| ---------------------------- | ------- | --------------------- |
| `architecture-evaluation.md` | ✅ KEEP | Architecture analysis |
| `function-flow.md`           | ✅ KEEP | Flow diagrams         |
| `cleanup-plan.md`            | ✅ KEEP | This cleanup plan     |
| `file-mapping.md`            | ✅ KEEP | This file             |

**Status:** Complete ✅

---

## Summary Statistics

### Files to Keep: ~40

- Entities: 5 files
- Use Cases: 9 files
- Adapters: 3 repositories
- Factories: 5 files (4 more needed)
- Frameworks: ~10 files
- App: 5 files
- Tests: Growing
- Utils: 1-2 files
- Docs: 4 files

### Files to Migrate: ~15

- Config: 4 files
- Routes: 5 files
- Middleware: 1 file
- Tests: 5 files

### Files to Delete: ~5

- `server.ts`
- `Structure.txt`
- `src/services/recipe.service.ts`
- Recipes moved to `server/data/` on 2025-11-10; delete only if confirmed unused

### Files to Review: ~5

- `server/data/Recipes.json` (moved on 2025-11-10)
- `server/data/IngredientSynonyms.json` (moved on 2025-11-10)
- `src/types/entities/`
- `src/utils/cleanRecipe.ts`
- `src/config/test-config.ts`

---

## Priority Actions

### High Priority (Do First)

1. ✅ Create missing factories (CreateRecipe, UpdateRecipe, DeleteRecipe, GetGroceryList)
2. 🔄 Migrate `src/config/` → `src/05_frameworks/`
3. 🔄 Migrate `src/routes/` → `src/05_frameworks/myexpress/routes/`
4. 🔄 Migrate `src/middleware/` → `src/05_frameworks/myexpress/middleware.ts`

### Medium Priority (Do Second)

5. 🔄 Migrate old tests to `src/07_tests/`
6. ❌ Delete `src/services/`
7. ❌ Delete `server.ts`
8. ⚠️ Review and decide on static JSON files

### Low Priority (Do Last)

9. 📝 Write missing tests
10. 📝 Update documentation
11. 📝 Add API documentation
12. 📝 Add deployment guide

---

## Validation Commands

After each migration step, run:

```bash
# TypeScript compilation
npm run build

# Run all tests
npm test

# Check for broken imports
npm run lint

# Start server
npm start
```

---

## Final Clean Architecture Structure

```
server/
  src/
    01_entities/           ✅ Complete
      User.ts
      Recipe.ts
      GroceryItem.ts
      AuditLog.ts
      index.ts

    02_use_cases/          ✅ Complete
      CreateRecipe.ts
      UpdateRecipe.ts
      DeleteRecipe.ts
      GetUserProfile.ts
      GetGroceryList.ts
      CheckAuthentication.ts
      LogoutUser.ts
      AuditLogging.ts
      index.ts

    03_adapters/           ⚠️ Needs controllers
      repositories/
        UserRepository.ts
        RecipeRepository.ts
        GroceryRepository.ts
      controllers/         ← Need to create/populate
        AuthController.ts
        RecipeController.ts
        GroceryController.ts
        ProfileController.ts

    04_factories/          ⚠️ Incomplete
      CheckAuthenticationFactory.ts
      GetUserProfileFactory.ts
      LogAuditFactory.ts
      LogoutUserFactory.ts
      CreateRecipeFactory.ts      ← Need to create
      UpdateRecipeFactory.ts      ← Need to create
      DeleteRecipeFactory.ts      ← Need to create
      GetGroceryListFactory.ts    ← Need to create
      index.ts

    05_frameworks/         ⚠️ Needs migration
      myexpress/
        app.ts
        middleware.ts
        routes/
          auth.routes.ts
          grocery.routes.ts
          recipes.routes.ts
          profile.routes.ts
          index.ts
      database/
        connection.ts
        schema.ts
        migrations/
          create_recipe_tables.ts
      auth/
        passport.ts
        sessions.ts
      index.ts

    06_app/                ✅ Complete
      main.ts
      server.ts
      database.ts
      environment.ts
      index.ts

    07_tests/              ⚠️ Incomplete
      01_entities/         ✅ Complete
      02_use_cases/        ❌ Empty
      03_adapters/         ❌ Empty
      04_factories/        ❌ Empty
      05_frameworks/       ❌ Empty
      06_app/              ⚠️ Partial
      test-utils.ts

    types/                 ✅ Keep
      express-session.d.ts
      express.d.ts
      passport-google-oidc.d.ts

    utils/                 ✅ Keep
      crypto.ts

  docs/                    ✅ Complete
    architecture-evaluation.md
    function-flow.md
    cleanup-plan.md
    file-mapping.md

  package.json             ✅ Keep
  tsconfig.json            ✅ Keep
  jest.config.ts           ✅ Keep
  jest.setup.ts            ✅ Keep
  jest.global-setup.ts     ✅ Keep
  jest.global-teardown.ts  ✅ Keep
  cloudbuild.yaml          ✅ Keep
```

---

## Notes

- This mapping is based on analysis of current codebase
- Some files may not exist yet (marked with ←)
- Verify actual file locations before migration
- Always test after each change
- Commit frequently during migration
