# Server Cleanup Plan

**Date:** November 10, 2025  
**Project:** SousChef Recipe Application

This document outlines a systematic approach to cleaning up the server codebase and migrating to a consistent Clean Architecture structure.

---

## Phase 1: Immediate Cleanup (Files to Delete)

### Legacy/Duplicate Files

These files should be deleted as they are no longer needed or have been superseded by Clean Architecture implementations:

1. **server.ts** (root level)

   - **Reason:** Replaced by `src/06_app/server.ts` and `src/06_app/main.ts`
   - **Action:** DELETE
   - **Risk:** Low (functionality migrated)

2. **src/services/recipe.service.ts**

   - **Reason:** Logic moved to use cases and repositories
   - **Action:** DELETE
   - **Risk:** Low (replaced by `02_use_cases/CreateRecipe.ts`, `UpdateRecipe.ts`, `DeleteRecipe.ts`)

3. **src/tests/** (old test location)

   - Files: `auth.test.ts`, `database.test.ts`, `db.test.ts`, `profile.test.ts`, `test-utils.ts`
   - **Reason:** Tests should be in `src/07_tests/` following Clean Architecture
   - **Action:** DELETE after migration
   - **Risk:** Medium (need to verify tests are migrated)

4. **Recipes.json** and **IngredientSynonyms.json** (root level)

   - **Reason:** Static data files not used in current implementation
   - **Action:** MOVED to `server/data/` on 2025-11-10: `server/data/Recipes.json` and `server/data/IngredientSynonyms.json`.
     - These files are retained as project seed/reference data; consider deleting if they become unused.
   - **Risk:** Low

5. **Structure.txt** (root level)
   - **Reason:** Outdated structure documentation
   - **Action:** DELETE (replaced by docs in `server/docs/`)
   - **Risk:** None

---

## Phase 2: Migration Tasks

### 2.1 Move Middleware

**Current:** `src/middleware/rateLimit.ts`  
**Target:** `src/05_frameworks/myexpress/middleware.ts`

**Action:**

- Check if rate limiting is already in `05_frameworks/myexpress/middleware.ts`
- If duplicate, delete `src/middleware/rateLimit.ts`
- If unique, merge into framework middleware
- Delete `src/middleware/` folder

### 2.2 Consolidate Configuration

**Current:** Multiple config locations

- `src/config/database.ts`
- `src/config/schema.ts`
- `src/config/test-config.ts`
- `src/config/auth/`

**Target:** Reorganize under Clean Architecture

**Action:**

```
src/05_frameworks/
  database/
    connection.ts (pool management)
    schema.ts (migrations)
  auth/
    passport.ts
    sessions.ts
```

**Steps:**

1. Move `src/config/database.ts` → `src/05_frameworks/database/connection.ts`
2. Move `src/config/schema.ts` → `src/05_frameworks/database/schema.ts`
3. Move `src/config/auth/*` → `src/05_frameworks/auth/`
4. Update all imports throughout codebase
5. Delete `src/config/` folder

### 2.3 Consolidate Routes

**Current:** `src/routes/`

- `auth.routes.ts`
- `grocery.routes.ts`
- `recipes.routes.ts`
- `profile.ts`
- `index.ts`

**Target:** `src/05_frameworks/myexpress/routes/`

**Action:**

1. Ensure all routes are in `05_frameworks/myexpress/routes/`
2. Delete `src/routes/` folder
3. Update imports in `app.ts`

### 2.4 Migrate Controllers

**Current:** Controllers may be scattered  
**Target:** `src/03_adapters/controllers/`

**Action:**

1. Identify all controllers
2. Move to `03_adapters/controllers/`
3. Ensure controllers call use cases via factories

---

## Phase 3: Test Migration

### 3.1 Move Old Tests

**Source:** `src/tests/`  
**Target:** `src/07_tests/`

**Current Tests:**

- `auth.test.ts` → `07_tests/05_frameworks/auth/auth.test.ts`
- `database.test.ts` → `07_tests/05_frameworks/database/database.test.ts`
- `db.test.ts` → (review and merge with database.test.ts)
- `profile.test.ts` → `07_tests/03_adapters/controllers/profile.test.ts`
- `test-utils.ts` → `07_tests/test-utils.ts`

### 3.2 Complete Integration Tests

**Priority Tests to Write:**

1. **Use Cases (02_use_cases/)**

   - `CreateRecipe.test.ts`
   - `UpdateRecipe.test.ts`
   - `DeleteRecipe.test.ts`
   - `GetUserProfile.test.ts`
   - `GetGroceryList.test.ts`
   - `CheckAuthentication.test.ts`
   - `LogoutUser.test.ts`
   - `AuditLogging.test.ts`

2. **Adapters (03_adapters/)**

   - `repositories/UserRepository.test.ts`
   - `repositories/RecipeRepository.test.ts`
   - `repositories/GroceryRepository.test.ts`
   - `controllers/*.test.ts`

3. **Factories (04_factories/)**

   - `CheckAuthenticationFactory.test.ts`
   - `GetUserProfileFactory.test.ts`
   - `LogAuditFactory.test.ts`
   - `LogoutUserFactory.test.ts`

4. **Frameworks (05_frameworks/)**
   - `database/connection.test.ts`
   - `auth/passport.test.ts`
   - `myexpress/app.test.ts`

---

## Phase 4: Utility Consolidation

### 4.1 Clean Recipe Logic

**Current Options:**

- `src/utils/cleanRecipe.ts` (if exists locally)
- `clean-recipe-service/` (microservice)

**Decision Needed:**

- Are we using the microservice or local utility?
- If microservice: delete local utility
- If local: document why microservice not used

### 4.2 Crypto Utilities

**Current:** `src/utils/crypto.ts`  
**Status:** Keep (used for encryption/decryption)

---

## Phase 5: Documentation Updates

### 5.1 Create Missing Docs

1. **API Documentation**

   - Endpoint descriptions
   - Request/response examples
   - Authentication requirements

2. **Deployment Guide**

   - Environment variables
   - Database setup
   - Production configuration

3. **Development Guide**
   - How to add new features
   - Testing strategy
   - Code conventions

### 5.2 Update README

- Add architecture overview
- Add setup instructions
- Add testing instructions
- Add deployment instructions

---

## Phase 6: Code Quality Improvements

### 6.1 Standardize Error Handling

- Create custom error classes
- Implement consistent error responses
- Add error logging

### 6.2 Add Validation Layer

- Input validation for all endpoints
- Schema validation using Zod or Joi
- Type safety improvements

### 6.3 Add Missing Types

- Review `src/types/` folder
- Ensure all custom types are defined
- Remove any unused type definitions

---

## Execution Order

### Week 1: Safe Deletions

1. Delete `server.ts` (root)
2. Delete `Structure.txt`
3. Delete `Recipes.json` and `IngredientSynonyms.json` (or move to `data/`)

### Week 2: Configuration Migration

1. Move `src/config/` → `src/05_frameworks/`
2. Update all imports
3. Test database connection
4. Test authentication

### Week 3: Routes & Middleware Migration

1. Move `src/routes/` → `src/05_frameworks/myexpress/routes/`
2. Move `src/middleware/` → `src/05_frameworks/myexpress/middleware.ts`
3. Update imports in `app.ts`
4. Test all endpoints

### Week 4: Test Migration

1. Move `src/tests/` → `src/07_tests/`
2. Run all tests
3. Fix any broken tests
4. Delete old test directory

### Week 5: Write Missing Tests

1. Write use case tests
2. Write adapter tests
3. Write factory tests
4. Write framework tests

### Week 6: Service Consolidation

1. Delete `src/services/`
2. Decide on cleanRecipe strategy
3. Document utility functions

### Week 7: Documentation

1. Create API documentation
2. Create deployment guide
3. Update README
4. Create development guide

---

## Verification Checklist

After each phase, verify:

- [ ] All tests pass
- [ ] Application runs without errors
- [ ] All imports are updated
- [ ] No circular dependencies
- [ ] TypeScript compiles without errors
- [ ] Database connections work
- [ ] Authentication works
- [ ] All endpoints respond correctly

---

## Rollback Plan

For each migration step:

1. Create a git branch before changes
2. Make changes incrementally
3. Test after each change
4. Commit working state
5. If issues arise, revert to last working commit

**Branch Naming Convention:**

- `cleanup/delete-legacy-files`
- `cleanup/migrate-config`
- `cleanup/migrate-routes`
- `cleanup/migrate-tests`
- `cleanup/write-tests`
- `cleanup/consolidate-services`
- `cleanup/update-docs`

---

## Success Metrics

After cleanup is complete:

1. **File Organization**

   - All files follow Clean Architecture structure
   - No duplicate files
   - No unused files

2. **Test Coverage**

   - All layers have integration tests
   - All critical paths tested
   - Test coverage > 80%

3. **Documentation**

   - Complete API docs
   - Complete deployment guide
   - Complete development guide

4. **Code Quality**

   - No TypeScript errors
   - No circular dependencies
   - Consistent error handling
   - Input validation on all endpoints

5. **Performance**
   - All tests run in < 30 seconds
   - Application starts in < 5 seconds
   - All endpoints respond in < 500ms

---

## Notes

- Always test after each migration step
- Keep git commits small and focused
- Document any issues encountered
- Update this plan as new information emerges

---

## Appendix: Running the clean-recipe-service locally

Quick steps to run the microservice locally and point the server at it for testing:

1. Install dependencies (once):

   ```powershell
   cd ..\clean-recipe-service
   npm install
   ```

2. Start the microservice (two options):

   - Fast (no build) — run with ts-node (needs ts-node available in dev environment):

     ```powershell
     npx ts-node src/index.ts
     ```

   - Build and run:

     ```powershell
     npx tsc -p tsconfig.json
     node dist/index.js
     ```

   The service listens on port 6000 by default. Set `PORT` to change it.

3. Point the server at the microservice (PowerShell example):

   ```powershell
   $env:CLEAN_RECIPE_SERVICE_URL = 'http://localhost:6000'
   # then start the server in a separate shell
   npm run dev
   ```

4. To run the server test suite while exercising the microservice path, start the microservice in a separate terminal and export `CLEAN_RECIPE_SERVICE_URL` as above before running `npm run test` in the server folder.

Notes:

- The server includes a fallback: when `CLEAN_RECIPE_SERVICE_URL` is not set or the microservice is unreachable, the app uses the local cleaning implementation so tests and local development keep working.
- Consider adding a CI job that builds and runs the microservice before running server tests if you want full end-to-end validation in CI.
