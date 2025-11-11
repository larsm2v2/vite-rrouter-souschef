import db from "../../../05_frameworks/database/connection";
import { initializeDatabase } from "../../../05_frameworks/database/schema";

describe("Database Schema", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  describe("Users Table", () => {
    it("should enforce unique google_sub constraint", async () => {
      const googleSub = `test-unique-${Date.now()}`;

      const client = await db.connect();
      try {
        await client.query(
          `INSERT INTO users (google_sub, email, display_name)
           VALUES ($1, $2, $3)`,
          [googleSub, "test1@example.com", "Test User 1"]
        );

        await expect(
          client.query(
            `INSERT INTO users (google_sub, email, display_name)
             VALUES ($1, $2, $3)`,
            [googleSub, "test2@example.com", "Test User 2"]
          )
        ).rejects.toThrow();

        await client.query("DELETE FROM users WHERE google_sub = $1", [
          googleSub,
        ]);
      } finally {
        client.release();
      }
    });

    it("should enforce unique email constraint", async () => {
      const email = `unique-email-${Date.now()}@example.com`;

      const client = await db.connect();
      try {
        await client.query(
          `INSERT INTO users (google_sub, email, display_name)
           VALUES ($1, $2, $3)`,
          [`sub-${Date.now()}`, email, "User A"]
        );

        await expect(
          client.query(
            `INSERT INTO users (google_sub, email, display_name)
             VALUES ($1, $2, $3)`,
            [`sub2-${Date.now()}`, email, "User B"]
          )
        ).rejects.toThrow();

        await client.query("DELETE FROM users WHERE email = $1", [email]);
      } finally {
        client.release();
      }
    });
  });

  describe("Audit Log Table", () => {
    it("should allow null user_id in audit_log", async () => {
      const client = await db.connect();
      try {
        const result = await client.query(
          `INSERT INTO audit_log (
            user_id, action, endpoint, ip_address, 
            user_agent, status_code, metadata
          ) VALUES (
            NULL, 'GET', '/test', '127.0.0.1',
            'test-agent', 200, '{"test": true}'
          ) RETURNING id`
        );

        expect(result.rows[0].id).toBeDefined();

        await client.query("DELETE FROM audit_log WHERE id = $1", [
          result.rows[0].id,
        ]);
      } finally {
        client.release();
      }
    });

    it("should enforce action length constraint", async () => {
      const longAction = "A".repeat(51); // Exceeds 50 char limit

      const client = await db.connect();
      try {
        await expect(
          client.query(
            `INSERT INTO audit_log (action, endpoint, ip_address)
             VALUES ($1, '/test', '127.0.0.1')`,
            [longAction]
          )
        ).rejects.toThrow();
      } finally {
        client.release();
      }
    });

    it("should enforce status_code range constraint", async () => {
      const client = await db.connect();
      try {
        await expect(
          client.query(
            `INSERT INTO audit_log (action, endpoint, ip_address, status_code)
             VALUES ('GET', '/test', '127.0.0.1', 999)`
          )
        ).rejects.toThrow();
      } finally {
        client.release();
      }
    });
  });

  describe("Foreign Key Constraints", () => {
    it("should set user_id to NULL when user is deleted", async () => {
      // Create user
      const client = await db.connect();
      try {
        const userResult = await client.query(
          `INSERT INTO users (google_sub, email, display_name)
           VALUES ($1, $2, $3) RETURNING id`,
          [`test-fk-${Date.now()}`, `test-fk@example.com`, "FK Test"]
        );
        const userId = userResult.rows[0].id;

        // Create audit log entry
        const auditResult = await client.query(
          `INSERT INTO audit_log (user_id, action, endpoint, ip_address)
           VALUES ($1, 'GET', '/test', '127.0.0.1') RETURNING id`,
          [userId]
        );
        const auditId = auditResult.rows[0].id;

        // Delete user
        await client.query("DELETE FROM users WHERE id = $1", [userId]);

        // Check audit log user_id is now NULL
        const checkResult = await client.query(
          "SELECT user_id FROM audit_log WHERE id = $1",
          [auditId]
        );
        expect(checkResult.rows[0].user_id).toBeNull();

        // Cleanup
        await client.query("DELETE FROM audit_log WHERE id = $1", [auditId]);
      } finally {
        client.release();
      }
    });
  });
});
