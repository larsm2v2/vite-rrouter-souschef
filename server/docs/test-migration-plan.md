# Test Migration Plan

**Date:** November 10, 2025  
**Project:** SousChef Recipe Application

This document outlines the plan to migrate tests from `src/tests/` to `src/07_tests/` following Clean Architecture structure.

---

## Current Test Files Analysis

### Files to Migrate

| Current Location | File               | Type        | Target Location                                        |
| ---------------- | ------------------ | ----------- | ------------------------------------------------------ |
| `src/tests/`     | `auth.test.ts`     | Integration | `src/07_tests/05_frameworks/auth/auth.test.ts`         |
| `src/tests/`     | `database.test.ts` | Integration | `src/07_tests/05_frameworks/database/database.test.ts` |
| `src/tests/`     | `db.test.ts`       | Integration | Merge into `database.test.ts`                          |
| `src/tests/`     | `profile.test.ts`  | Integration | `src/07_tests/06_app/routes/profile.test.ts`           |
| `src/tests/`     | `test-utils.ts`    | Utility     | `src/07_tests/test-utils.ts`                           |

---

## File-by-File Migration Plan

### 1. `test-utils.ts` ✅ (Migrate First)

**Current Location:** `src/tests/test-utils.ts`  
**Target Location:** `src/07_tests/test-utils.ts`

**Changes Required:**

- Update import path: `import pool from "../config/database"` → `import pool from "../05_frameworks/database/connection"`
- Update import path: `import { User } from "../types/entities/User"` → `import { User } from "../01_entities"`
- Keep all utility functions as-is

**Priority:** HIGH (other tests depend on this)

**Code Changes:**

```typescript
// OLD IMPORTS
import pool from "../config/database";
import { User } from "../types/entities/User";

// NEW IMPORTS
import pool from "../05_frameworks/database/connection";
import { User } from "../01_entities";
```

---

### 2. `auth.test.ts` 🔄 (Refactor & Migrate)

**Current Location:** `src/tests/auth.test.ts`  
**Target Location:** `src/07_tests/05_frameworks/auth/auth.test.ts`

**Current Issues:**

- Tests Google OAuth routes from `app.ts` (not in auth layer)
- Imports from scattered locations
- Mixes framework testing with application testing

**Recommended Approach:**

#### Option A: Split into Two Test Files

**File 1:** `src/07_tests/05_frameworks/auth/passport.test.ts`

- Test Passport configuration
- Test authentication strategies
- Test serialize/deserialize functions

**File 2:** `src/07_tests/06_app/routes/auth.test.ts`

- Test `/auth/google` route
- Test `/auth/google/callback` route
- Full integration test with app

**Code Changes for `passport.test.ts`:**

```typescript
// Test the Passport configuration itself
import passport from "../../../05_frameworks/auth/passport";
import { User } from "../../../01_entities";

describe("Passport Configuration", () => {
  describe("Google OAuth Strategy", () => {
    it("should be configured correctly", () => {
      const strategy = passport._strategies["google"];
      expect(strategy).toBeDefined();
      expect(strategy.name).toBe("google");
    });
  });

  describe("Serialization", () => {
    it("should serialize user correctly", (done) => {
      const user: User = {
        id: 1,
        email: "test@example.com",
        displayName: "Test",
      };
      passport.serializeUser(user, (err, id) => {
        expect(err).toBeNull();
        expect(id).toBe(1);
        done();
      });
    });
  });

  describe("Deserialization", () => {
    it("should deserialize user correctly", async () => {
      // Test deserialization logic
    });
  });
});
```

**Code Changes for `auth.test.ts` (routes):**

```typescript
import request from "supertest";
import app from "../../../app";
import pool from "../../../05_frameworks/database/connection";
import { initializeDatabase } from "../../../05_frameworks/database/schema";
import { User } from "../../../01_entities";

describe("Authentication Routes", () => {
  let testUser: User;

  beforeAll(async () => {
    await initializeDatabase();
    const result = await pool.query(
      `INSERT INTO users (google_sub, display_name, email) 
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name`,
      ["test-google-id", "Test User", "test@example.com"]
    );
    testUser = result.rows[0];
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [testUser.id]);
  });

  describe("GET /auth/google", () => {
    it("should redirect to Google OAuth", async () => {
      const res = await request(app).get("/auth/google");
      expect(res.status).toBe(302);
      expect(res.header.location).toMatch(/accounts\.google\.com/);
    });
  });

  describe("GET /auth/google/callback", () => {
    it("should handle the OAuth callback successfully", async () => {
      // Keep existing test logic
    });

    it("should handle OAuth callback failure", async () => {
      // Keep existing test logic
    });
  });
});
```

**Priority:** HIGH

---

### 3. `database.test.ts` 🔄 (Refactor & Migrate)

**Current Location:** `src/tests/database.test.ts`  
**Target Location:** `src/07_tests/05_frameworks/database/database.test.ts`

**Current Issues:**

- Tests raw database operations
- Tests repository-level logic (should be in adapter tests)
- Mixes concerns

**Recommended Approach:**

#### Option A: Keep as Framework Test (Connection & Schema)

Test only the database connection and schema initialization:

```typescript
import pool from "../../../05_frameworks/database/connection";
import { initializeDatabase } from "../../../05_frameworks/database/schema";

describe("Database Framework", () => {
  describe("Connection Pool", () => {
    it("should connect to database successfully", async () => {
      const result = await pool.query("SELECT 1 as test");
      expect(result.rows[0].test).toBe(1);
    });

    it("should handle queries with parameters", async () => {
      const result = await pool.query("SELECT $1::text as value", ["test"]);
      expect(result.rows[0].value).toBe("test");
    });
  });

  describe("Schema Initialization", () => {
    it("should initialize database schema", async () => {
      await expect(initializeDatabase()).resolves.not.toThrow();
    });

    it("should create all required tables", async () => {
      await initializeDatabase();

      const tables = ["users", "recipes", "grocery_list", "audit_log"];
      for (const table of tables) {
        const result = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )`,
          [table]
        );
        expect(result.rows[0].exists).toBe(true);
      }
    });
  });
});
```

#### Option B: Move Repository Operations to Adapter Tests

Create separate tests for repository operations:

**File:** `src/07_tests/03_adapters/repositories/UserRepository.test.ts`

```typescript
import { UserRepository } from "../../../03_adapters/repositories/UserRepository";
import pool from "../../../05_frameworks/database/connection";
import { initializeDatabase } from "../../../05_frameworks/database/schema";

describe("UserRepository", () => {
  let repository: UserRepository;
  let userId: number;

  beforeAll(async () => {
    await initializeDatabase();
    repository = new UserRepository();
  });

  afterAll(async () => {
    if (userId) {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
  });

  it("should retrieve a user by google_sub", async () => {
    // Move user-specific tests here
  });

  it("should create a new user", async () => {
    // Move create user tests here
  });
});
```

**Priority:** MEDIUM

---

### 4. `db.test.ts` 🔄 (Merge & Migrate)

**Current Location:** `src/tests/db.test.ts`  
**Target Location:** Merge into `src/07_tests/05_frameworks/database/schema.test.ts`

**Current Focus:**

- Tests schema structure (audit_log table)
- Tests constraint validation

**Recommended Approach:**
Create a dedicated schema test file:

**File:** `src/07_tests/05_frameworks/database/schema.test.ts`

```typescript
import pool from "../../../05_frameworks/database/connection";
import { initializeDatabase } from "../../../05_frameworks/database/schema";

describe("Database Schema", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  describe("Users Table", () => {
    it("should enforce unique google_sub constraint", async () => {
      const googleSub = `test-unique-${Date.now()}`;

      await pool.query(
        `INSERT INTO users (google_sub, email, display_name)
         VALUES ($1, $2, $3)`,
        [googleSub, "test1@example.com", "Test User 1"]
      );

      await expect(
        pool.query(
          `INSERT INTO users (google_sub, email, display_name)
           VALUES ($1, $2, $3)`,
          [googleSub, "test2@example.com", "Test User 2"]
        )
      ).rejects.toThrow();

      await pool.query("DELETE FROM users WHERE google_sub = $1", [googleSub]);
    });

    it("should enforce unique email constraint", async () => {
      // Similar test for email uniqueness
    });
  });

  describe("Audit Log Table", () => {
    it("should allow null user_id in audit_log", async () => {
      const result = await pool.query(
        `INSERT INTO audit_log (
          user_id, action, endpoint, ip_address, 
          user_agent, status_code, metadata
        ) VALUES (
          NULL, 'GET', '/test', '127.0.0.1',
          'test-agent', 200, '{"test": true}'
        ) RETURNING id`
      );

      expect(result.rows[0].id).toBeDefined();

      await pool.query("DELETE FROM audit_log WHERE id = $1", [
        result.rows[0].id,
      ]);
    });

    it("should enforce action length constraint", async () => {
      const longAction = "A".repeat(51); // Exceeds 50 char limit

      await expect(
        pool.query(
          `INSERT INTO audit_log (action, endpoint, ip_address)
           VALUES ($1, '/test', '127.0.0.1')`,
          [longAction]
        )
      ).rejects.toThrow();
    });

    it("should enforce status_code range constraint", async () => {
      await expect(
        pool.query(
          `INSERT INTO audit_log (action, endpoint, ip_address, status_code)
           VALUES ('GET', '/test', '127.0.0.1', 999)`
        )
      ).rejects.toThrow();
    });
  });

  describe("Foreign Key Constraints", () => {
    it("should set user_id to NULL when user is deleted", async () => {
      // Create user
      const userResult = await pool.query(
        `INSERT INTO users (google_sub, email, display_name)
         VALUES ($1, $2, $3) RETURNING id`,
        [`test-fk-${Date.now()}`, `test-fk@example.com`, "FK Test"]
      );
      const userId = userResult.rows[0].id;

      // Create audit log entry
      const auditResult = await pool.query(
        `INSERT INTO audit_log (user_id, action, endpoint, ip_address)
         VALUES ($1, 'GET', '/test', '127.0.0.1') RETURNING id`,
        [userId]
      );
      const auditId = auditResult.rows[0].id;

      // Delete user
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);

      // Check audit log user_id is now NULL
      const checkResult = await pool.query(
        "SELECT user_id FROM audit_log WHERE id = $1",
        [auditId]
      );
      expect(checkResult.rows[0].user_id).toBeNull();

      // Cleanup
      await pool.query("DELETE FROM audit_log WHERE id = $1", [auditId]);
    });
  });
});
```

**Priority:** MEDIUM

---

### 5. `profile.test.ts` 🔄 (Refactor & Migrate)

**Current Location:** `src/tests/profile.test.ts`  
**Target Location:** `src/07_tests/06_app/routes/profile.test.ts`

**Current Issues:**

- Only tests one scenario (401 unauthorized)
- Uses test-utils (good!)
- Tests app-level route

**Recommended Approach:**
Expand tests and migrate:

```typescript
import request from "supertest";
import app from "../../../app";
import pool from "../../../05_frameworks/database/connection";
import { initializeDatabase } from "../../../05_frameworks/database/schema";
import { User } from "../../../01_entities";
import { createTestUser } from "../../test-utils";

describe("Profile Routes", () => {
  let testUser: User;

  beforeAll(async () => {
    await initializeDatabase();
    testUser = await createTestUser();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [testUser.id]);
  });

  describe("GET /profile", () => {
    it("should return 401 if not authenticated", async () => {
      const res = await request(app).get("/profile");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    });

    it("should return user profile if authenticated", async () => {
      // Mock authentication session
      const agent = request.agent(app);

      // Set up authenticated session
      // Note: This will need session mocking or actual auth setup

      const res = await agent.get("/profile");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("email");
      expect(res.body).toHaveProperty("displayName");
    });
  });
});
```

**Priority:** LOW (can expand later)

---

## Migration Execution Order

### Phase 1: Setup (Week 1)

1. ✅ Create folder structure:

   ```
   src/07_tests/
     03_adapters/
       repositories/
     05_frameworks/
       auth/
       database/
     06_app/
       routes/
   ```

2. ✅ Migrate `test-utils.ts`
   - Move file
   - Update imports
   - Run tests to verify

### Phase 2: Framework Tests (Week 2)

3. 🔄 Split and migrate `auth.test.ts`

   - Create `05_frameworks/auth/passport.test.ts`
   - Create `06_app/routes/auth.test.ts`
   - Update imports
   - Run tests

4. 🔄 Migrate `database.test.ts`

   - Create `05_frameworks/database/database.test.ts`
   - Extract connection tests
   - Update imports
   - Run tests

5. 🔄 Create `schema.test.ts`
   - Merge content from `db.test.ts`
   - Add constraint tests
   - Add foreign key tests
   - Run tests

### Phase 3: Application Tests (Week 3)

6. 🔄 Migrate `profile.test.ts`
   - Move to `06_app/routes/profile.test.ts`
   - Expand test coverage
   - Update imports
   - Run tests

### Phase 4: Repository Tests (Week 4)

7. 📝 Create repository tests (NEW)
   - Extract database operations from `database.test.ts`
   - Create `03_adapters/repositories/UserRepository.test.ts`
   - Create `03_adapters/repositories/RecipeRepository.test.ts`
   - Create `03_adapters/repositories/GroceryRepository.test.ts`

### Phase 5: Cleanup (Week 5)

8. ❌ Delete old `src/tests/` folder
   - Verify all tests passing in new locations
   - Delete old folder
   - Update any documentation

---

## Import Path Reference

### Common Import Changes

| Old Import                | New Import (from 07_tests/)               |
| ------------------------- | ----------------------------------------- |
| `../config/database`      | `../05_frameworks/database/connection`    |
| `../config/schema`        | `../05_frameworks/database/schema`        |
| `../config/auth/passport` | `../05_frameworks/auth/passport`          |
| `../types/entities/User`  | `../01_entities`                          |
| `../app`                  | `../app` (unchanged if app.ts is in src/) |
| `./test-utils`            | `./test-utils` (after migration)          |

---

## Verification Checklist

After each migration step:

- [ ] All imports updated to new paths
- [ ] Tests run successfully (`npm test`)
- [ ] No TypeScript compilation errors
- [ ] Test coverage maintained or improved
- [ ] No duplicate tests
- [ ] Database cleanup working correctly

---

## New Test Structure (Final)

```
src/07_tests/
  test-utils.ts                           ← Migrated from src/tests/

  01_entities/                            ✅ Already complete
    User.test.ts
    Recipe.test.ts
    GroceryItem.test.ts

  02_use_cases/                           📝 To be written
    CreateRecipe.test.ts
    UpdateRecipe.test.ts
    DeleteRecipe.test.ts
    GetUserProfile.test.ts
    GetGroceryList.test.ts
    CheckAuthentication.test.ts
    LogoutUser.test.ts
    AuditLogging.test.ts

  03_adapters/                            📝 To be written
    repositories/
      UserRepository.test.ts              ← Extract from database.test.ts
      RecipeRepository.test.ts            ← Extract from database.test.ts
      GroceryRepository.test.ts           ← Extract from database.test.ts
    controllers/
      AuthController.test.ts
      RecipeController.test.ts
      GroceryController.test.ts

  04_factories/                           📝 To be written
    CheckAuthenticationFactory.test.ts
    GetUserProfileFactory.test.ts
    LogAuditFactory.test.ts
    LogoutUserFactory.test.ts

  05_frameworks/                          🔄 Migrating now
    auth/
      passport.test.ts                    ← Split from auth.test.ts
    database/
      connection.test.ts                  ← Renamed from database.test.ts
      schema.test.ts                      ← Merged from db.test.ts

  06_app/                                 🔄 Migrating now
    routes/
      auth.test.ts                        ← Split from auth.test.ts
      profile.test.ts                     ← Migrated from profile.test.ts
    app.test.ts                           ← Expand existing empty file
```

---

## Notes

- **Import Paths:** Always use relative paths from test file to source file
- **Database Cleanup:** Ensure proper cleanup in afterAll/afterEach hooks
- **Test Isolation:** Each test should be independent
- **Session Mocking:** May need to set up session mocking for authenticated route tests
- **Parallel Execution:** Ensure tests can run in parallel without conflicts

---

## Success Metrics

After migration is complete:

- ✅ All tests pass in new locations
- ✅ Old `src/tests/` folder deleted
- ✅ Test coverage maintained or improved
- ✅ No duplicate tests
- ✅ All imports use Clean Architecture paths
- ✅ Tests organized by layer
- ✅ Test utilities properly shared
