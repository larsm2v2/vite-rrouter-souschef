import db from "../../../05_frameworks/database/connection";
import { initializeDatabase } from "../../../05_frameworks/database/schema";

describe("Database Framework", () => {
  describe("Connection Pool", () => {
    it("should connect to database successfully", async () => {
      const client = await db.connect();
      try {
        const result = await client.query("SELECT 1 as test");
        expect(result.rows[0].test).toBe(1);
      } finally {
        client.release();
      }
    });

    it("should handle queries with parameters", async () => {
      const client = await db.connect();
      try {
        const result = await client.query("SELECT $1::text as value", ["test"]);
        expect(result.rows[0].value).toBe("test");
      } finally {
        client.release();
      }
    });
  });

  describe("Schema Initialization", () => {
    it("should initialize database schema", async () => {
      await expect(initializeDatabase()).resolves.not.toThrow();
    });

    it("should create all required tables", async () => {
      await initializeDatabase();

      const tables = ["users", "recipes", "grocery_list", "audit_log"];
      const client = await db.connect();
      try {
        for (const table of tables) {
          const result = await client.query(
            `SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = $1
            )`,
            [table]
          );
          expect(result.rows[0].exists).toBe(true);
        }
      } finally {
        client.release();
      }
    });
  });
});
