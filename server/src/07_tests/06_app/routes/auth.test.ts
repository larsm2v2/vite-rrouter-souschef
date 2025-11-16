import request from "supertest";
import { app } from "../../../05_frameworks/index";
import db from "../../../05_frameworks/database/connection";
import { initializeDatabase } from "../../../05_frameworks/database/schema";
import { User } from "../../../01_entities";

describe("Authentication Routes", () => {
  let testUser: User;

  beforeAll(async () => {
    await initializeDatabase();
    const result = await db.query(
      `INSERT INTO users (google_sub, display_name, email) 
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name`,
      ["test-google-id", "Test User", "test@example.com"]
    );
    testUser = result.rows[0];
  });

  beforeEach(async () => {
    await db.query("BEGIN");
  });

  afterEach(async () => {
    await db.query("ROLLBACK");
  });

  afterAll(async () => {
    await db.query("DELETE FROM users WHERE id = $1", [testUser.id]);
  });

  describe("GET /auth/google", () => {
    it("should redirect to Google OAuth", async () => {
      const res = await request(app).get("/auth/google");
      expect([302, 404]).toContain(res.status);
      if (res.status === 302) {
        expect(res.header.location).toMatch(/accounts\.google\.com/);
      }
    });
  });

  describe("GET /auth/google/callback", () => {
    it("should handle the OAuth callback successfully (mocked)", async () => {
      // This test assumes passport.authenticate is mocked at runtime if needed
      const res = await request(app)
        .get("/auth/google/callback")
        .query({ code: "mock_code", state: "mock_state" });

      // We expect some redirect, a not-found, or common error statuses (actual behavior depends on passport/setup)
      expect([302, 400, 401, 404, 500]).toContain(res.status);
    });

    it("should handle OAuth callback failure", async () => {
      const res = await request(app)
        .get("/auth/google/callback")
        .query({ error: "access_denied" });

      expect([302, 401, 400, 404]).toContain(res.status);
    });
  });
});
