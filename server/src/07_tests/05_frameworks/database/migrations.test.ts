import { initializeDatabase } from "../../../05_frameworks/database/schema";
import migrateRunner from "../../../05_frameworks/database/migrations/migrations";
import pool from "../../../05_frameworks/database/connection";

describe("Database migrations runner", () => {
  beforeAll(async () => {
    // Ensure base schema exists
    await initializeDatabase();
  });

  afterAll(async () => {
    // Clean up - drop table if it exists
    try {
      await pool.query("DROP TABLE IF EXISTS refresh_tokens");
    } catch (err) {
      // ignore
    }
    await pool.end();
  });

  it("applies refresh token migration", async () => {
    // Run migration runner (idempotent)
    await migrateRunner();

    // Verify the table exists
    const res = await pool.query(
      "SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='refresh_tokens') as exists"
    );
    expect(res.rows[0].exists).toBe(true);
  }, 15000);
});
