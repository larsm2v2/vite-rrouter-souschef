# Server Architecture Evaluation

**Date:** November 10, 2025  
**Project:** SousChef Recipe Application  
**Architecture:** Clean Architecture

## Current State Overview

The server is transitioning to Clean Architecture with numbered folders (01-07) representing layers. However, there are legacy folders (`config`, `middleware`, `migrations`, `routes`, `services`, `tests`, `types`, `utils`) that need to be evaluated for consolidation or removal.

---

## Layer Structure (Clean Architecture)

### ✅ 01_entities/

**Status:** KEEP - Properly implemented  
**Purpose:** Core domain models  
**Files:**

- `AuditLog.ts` - Audit log entity
- `GroceryItem.ts` - Grocery item entity with TypeORM schema
- `Recipe.ts` - Recipe entity with TypeORM schema
- `User.ts` - User entity with TypeORM schema
- `index.ts` - Barrel export

**Assessment:** Well-structured, entities are independent of frameworks.

---

### ✅ 02_use_cases/

**Status:** KEEP - Properly implemented  
**Purpose:** Application-specific business logic  
**Files:**

- `AuditLogging.ts` - Audit logging use case
- `CheckAuthentication.ts` - Authentication check use case
- `CreateRecipe.ts` - Recipe creation use case
- `DeleteRecipe.ts` - Recipe deletion use case
- `GetGroceryList.ts` - Grocery list retrieval use case
- `GetUserProfile.ts` - User profile retrieval use case
- `LogoutUser.ts` - User logout use case
- `UpdateRecipe.ts` - Recipe update use case
- `index.ts` - Barrel export

**Assessment:** Use cases properly encapsulate business logic. Good separation of concerns.

---

### ✅ 03_adapters/

**Status:** KEEP - Properly implemented  
**Purpose:** Interface adapters (controllers, repositories)  
**Structure:**

```
03_adapters/
├── controllers/
│   ├── GroceryController.ts
│   ├── RecipeController.ts
│   ├── UserController.ts
│   └── index.ts
└── repositories/
    ├── GroceryRepository.ts
    ├── RecipeRepository.ts
    ├── UserRepository.ts
    └── index.ts
```

**Assessment:** Clean separation between controllers (HTTP layer) and repositories (data layer).

---

### ✅ 04_factories/

**Status:** KEEP - Properly implemented  
**Purpose:** Dependency injection via factory pattern  
**Files:**

- `CheckAuthenticationFactory.ts`
- `GetUserProfileFactory.ts`
- `LogAuditFactory.ts`
- `LogoutUserFactory.ts`
- `index.ts`

**Assessment:** Good implementation of factory pattern for DI. Centralized dependency management.

---

### ✅ 05_frameworks/

**Status:** KEEP - Properly implemented  
**Purpose:** External frameworks and drivers  
**Structure:**

```
05_frameworks/
├── auth/
│   ├── passport.ts - Passport.js configuration
│   ├── sessions.ts - Session management
│   └── index.ts
├── database/
│   ├── connection.ts - PostgreSQL connection
│   ├── migrations/
│   │   └── migrations.ts
│   └── index.ts
├── myexpress/
│   ├── app.ts - Express app configuration
│   ├── middleware.ts - Custom middleware
│   ├── routes.ts - Route definitions
│   └── index.ts
└── index.ts
```

**Assessment:** Well-organized. Frameworks are properly isolated.

---

### ✅ 06_app/

**Status:** KEEP - Properly implemented  
**Purpose:** Application entry point and initialization  
**Files:**

- `database.ts` - Database initialization logic
- `environment.ts` - Environment variable validation
- `main.ts` - Main entry point
- `server.ts` - Server startup logic
- `index.ts` - Barrel export

**Assessment:** Clean entry point with proper initialization sequence.

---

### ✅ 07_tests/

**Status:** KEEP - Partially implemented  
**Purpose:** Integration and unit tests  
**Structure:**

```
07_tests/
├── 01_entities/
│   ├── GroceryItem.test.ts ✅
│   ├── Recipe.test.ts ✅
│   └── User.test.ts ✅
├── 02_use_cases/ (empty - needs tests)
├── 03_adapters/ (empty - needs tests)
├── 04_factories/ (empty - needs tests)
├── 05_frameworks/ (empty - needs tests)
├── 06_app/ (empty - needs tests)
└── app.test.ts
```

**Assessment:** Entity tests complete. Need tests for other layers.

---

## Legacy Folders - Migration Required

### ⚠️ config/

**Status:** MIGRATE to 05_frameworks/  
**Current Files:**

- `database.ts` → **DUPLICATE** of `05_frameworks/database/connection.ts`
- `schema.ts` → **MIGRATE** to `05_frameworks/database/schema.ts`
- `test-config.ts` → **MIGRATE** to `07_tests/config.ts`
- `auth/passport.ts` → **DUPLICATE** of `05_frameworks/auth/passport.ts`
- `auth/password.ts` → **MIGRATE** to `utils/password.ts` or delete if unused
- `auth/sessions.ts` → **DUPLICATE** of `05_frameworks/auth/sessions.ts`

**Action:** Consolidate into 05_frameworks, delete duplicates.

---

### ⚠️ middleware/

**Status:** MIGRATE to 05_frameworks/myexpress/  
**Current Files:**

- `rateLimit.ts` → **MIGRATE** to `05_frameworks/myexpress/middleware.ts`

**Action:** Move rate limiting middleware to frameworks layer.

---

### ⚠️ migrations/

**Status:** MIGRATE to 05_frameworks/database/  
**Current Files:**

- `create_recipe_tables.ts` → **MIGRATE** to `05_frameworks/database/migrations/`

**Action:** Consolidate all migrations in one location.

---

### ⚠️ routes/

**Status:** MIGRATE to 05_frameworks/myexpress/  
**Current Files:**

- `auth.routes.ts` → **MIGRATE** to `05_frameworks/myexpress/routes/auth.ts`
- `grocery.routes.ts` → **MIGRATE** to `05_frameworks/myexpress/routes/grocery.ts`
- `profile.ts` → **MIGRATE** to `05_frameworks/myexpress/routes/profile.ts`
- `recipes.routes.ts` → **MIGRATE** to `05_frameworks/myexpress/routes/recipes.ts`
- `index.ts` → **MIGRATE** to `05_frameworks/myexpress/routes/index.ts`

**Action:** Move all routes to frameworks layer.

---

### ⚠️ services/

**Status:** EVALUATE - May be obsolete  
**Current Files:**

- `recipe.service.ts` - Contains `cleanRecipe` function

**Action:**

- The `cleanRecipe` function has been moved to the `clean-recipe-service` microservice
- **DELETE** this folder if no other services exist
- If `cleanRecipe` is still used locally, move to `utils/`

---

### ⚠️ tests/

**Status:** MIGRATE to 07_tests/  
**Current Files:**

- `auth.test.ts` → **MIGRATE** to `07_tests/05_frameworks/auth.test.ts`
- `database.test.ts` → **MIGRATE** to `07_tests/05_frameworks/database.test.ts`
- `db.test.ts` → **CONSOLIDATE** with `database.test.ts`
- `profile.test.ts` → **MIGRATE** to `07_tests/03_adapters/profile.test.ts`
- `test-utils.ts` → **MIGRATE** to `07_tests/utils.ts`

**Action:** Consolidate all tests in 07_tests folder.

---

### ✅ types/

**Status:** KEEP - But organize better  
**Current Files:**

- `express-session.d.ts` - Express session type declarations
- `express.d.ts` - Express type declarations
- `passport-google-oidc.d.ts` - Passport type declarations
- `entities/GoogleProfile.ts` - Google profile entity
- `entities/User.ts` → **DUPLICATE** of `01_entities/User.ts`

**Action:**

- Keep type declarations at root level
- **DELETE** `entities/User.ts` (duplicate)
- Move `entities/GoogleProfile.ts` to `01_entities/GoogleProfile.ts`

---

### ✅ utils/

**Status:** KEEP  
**Current Files:**

- `crypto.ts` - Encryption/decryption utilities

**Assessment:** Utility functions are framework-agnostic. Keep this folder.

---

### ⚠️ app.ts

**Status:** MIGRATE to 06_app/  
**Current File:** `app.ts` at root level

**Action:** This appears to be legacy. The new entry point is `06_app/main.ts`. If `app.ts` is still being used, consolidate logic into `06_app/`.

---

## Files to DELETE

1. **Duplicates:**

   - `config/database.ts` (use `05_frameworks/database/connection.ts`)
   - `config/auth/passport.ts` (use `05_frameworks/auth/passport.ts`)
   - `config/auth/sessions.ts` (use `05_frameworks/auth/sessions.ts`)
   - `types/entities/User.ts` (use `01_entities/User.ts`)
   - `tests/db.test.ts` (consolidate with `database.test.ts`)

2. **Obsolete:**
   - `services/recipe.service.ts` (moved to microservice)
   - `app.ts` (if using `06_app/main.ts`)

---

## Summary

### Files to KEEP (No Changes)

- All files in `01_entities/`
- All files in `02_use_cases/`
- All files in `03_adapters/`
- All files in `04_factories/`
- All files in `05_frameworks/`
- All files in `06_app/`
- Completed tests in `07_tests/01_entities/`
- Type declarations in `types/` (except duplicates)
- `utils/crypto.ts`

### Files to MIGRATE

- `config/schema.ts` → `05_frameworks/database/schema.ts`
- `config/test-config.ts` → `07_tests/config.ts`
- `middleware/rateLimit.ts` → `05_frameworks/myexpress/middleware.ts`
- `migrations/create_recipe_tables.ts` → `05_frameworks/database/migrations/`
- All files in `routes/` → `05_frameworks/myexpress/routes/`
- All files in `tests/` → `07_tests/`
- `types/entities/GoogleProfile.ts` → `01_entities/GoogleProfile.ts`

### Files to DELETE

- `config/database.ts`
- `config/auth/passport.ts`
- `config/auth/sessions.ts`
- `config/auth/password.ts` (if unused)
- `types/entities/User.ts`
- `tests/db.test.ts`
- `services/recipe.service.ts`
- `app.ts` (if obsolete)

### Folders to DELETE (after migration)

- `config/`
- `middleware/`
- `migrations/`
- `routes/`
- `services/`
- `tests/`
- `types/entities/`
