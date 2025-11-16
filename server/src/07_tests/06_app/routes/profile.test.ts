import request from "supertest";
import { app } from "../../../05_frameworks/index";
import db from "../../../05_frameworks/database/connection";
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
    await db.query("DELETE FROM users WHERE id = $1", [testUser.id]);
  });

  describe("GET /profile", () => {
    it("should return 401 if not authenticated", async () => {
      const res = await request(app).get("/profile");
      expect(res.status).toBe(401);
    });

    it("should return user profile if authenticated (placeholder)", async () => {
      // This requires session setup or passport mocking. Placeholder for future expansion.
      expect(true).toBe(true);
    });
  });
});
