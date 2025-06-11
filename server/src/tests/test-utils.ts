// src/tests/test-utils.ts
import pool from "../config/database";
import { User } from "../types/entities/User"; // Add this import

export async function createTestUser(): Promise<User> {
  const result = await pool.query<User>(
    `INSERT INTO users (google_sub, email, display_name) 
     VALUES ($1, $2, $3) 
     RETURNING id, email, display_name`,
    [`test-sub-${Date.now()}`, `test-${Date.now()}@example.com`, "Test User"]
  );
  return result.rows[0];
}

export async function createCompleteTestUser() {
  const user = await createTestUser();
  await pool.query(`INSERT INTO game_stats (user_id) VALUES ($1)`, [user.id]);
  return user;
}

export async function cleanupTestData() {
  try {
    await pool.query("DELETE FROM game_stats");
    await pool.query("DELETE FROM users");
  } catch (err) {
    console.error('Error cleaning up test data:', err);
  }
}

// Clean up after each test
afterEach(async () => {
  await cleanupTestData();
});

// Clean up after all tests
afterAll(async () => {
  await pool.end();
});

export function toJsonb(value: any): string {
  return JSON.stringify(value);
}

export function fromJsonb<T>(value: string): T {
  return JSON.parse(value);
}
