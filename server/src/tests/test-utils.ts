// src/tests/test-utils.ts
import pool from "../config/database";
import { User } from "../types/entities/User";

let testUserIds: number[] = [];
let poolClient: any = null;

export async function createTestUser(): Promise<User> {
  const googleSub = `test-sub-${Date.now()}`;
  const email = `test-${Date.now()}@example.com`;

  // Get a single client for all operations
  if (!poolClient) {
    poolClient = await pool.connect();
  }

  try {
    const result = await poolClient.query(
      `INSERT INTO users (google_sub, email, display_name) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, display_name`,
      [googleSub, email, "Test User"]
    );

    testUserIds.push(result.rows[0].id);
    return result.rows[0];
  } catch (err) {
    console.error("Error creating test user:", err);
    throw err;
  }
}

export async function cleanupTestData() {
  try {
    // Only delete specific test users we've created
    if (testUserIds.length > 0) {
      if (!poolClient) {
        poolClient = await pool.connect();
      }

      await poolClient.query("BEGIN");

      await poolClient.query(
        `DELETE FROM grocery_list WHERE user_id = ANY($1)`,
        [testUserIds]
      );
      await poolClient.query(`DELETE FROM recipes WHERE user_id = ANY($1)`, [
        testUserIds,
      ]);
      await poolClient.query(`DELETE FROM users WHERE id = ANY($1)`, [
        testUserIds,
      ]);

      await poolClient.query("COMMIT");
      testUserIds = [];
    }
  } catch (err) {
    if (poolClient) {
      await poolClient.query("ROLLBACK");
    }
    console.error("Error cleaning up test data:", err);
  }
}

// Clean up after each test
afterEach(async () => {
  await cleanupTestData();
});

// Add this to the global afterAll hook
afterAll(async () => {
  // Release the client back to the pool
  if (poolClient) {
    poolClient.release();
    poolClient = null;
  }

  // Close the pool connection after all tests
  try {
    await pool.end();
    console.log("Pool closed after tests");
  } catch (err) {
    console.error("Error closing pool after tests:", err);
  }
});

export function toJsonb(value: any): string {
  return JSON.stringify(value);
}

export function fromJsonb<T>(value: string): T {
  return JSON.parse(value);
}
