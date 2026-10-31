import { initializeDatabase } from "../../../05_frameworks/database/schema";
import migrateRunner from "../../../05_frameworks/database/migrations/migrations";
import pool from "../../../05_frameworks/database/connection";

describe("Database migrations runner", () => {
  beforeAll(async () => {
    // Ensure base schema exists
    await initializeDatabase();
  });

  afterAll(async () => {
    // Note: refresh_tokens is permanent app schema (created once for the
    // whole test run by jest.global-setup.ts) and is relied upon by other
    // suites (e.g. auth.refresh.integration.test.ts), so it must NOT be
    // dropped here. Previously this dropped the table without clearing its
    // schema_version marker, which caused the migration runner to
    // permanently "skip" recreating it on every subsequent run.
    await pool.end();
  });

  it("applies refresh token migration", async () => {
    // Run migration runner (idempotent)
    await migrateRunner();

    // Verify the table exists
    const res = await pool.query(
      "SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='refresh_tokens') as exists",
    );
    expect(res.rows[0].exists).toBe(true);
  }, 15000);
});
