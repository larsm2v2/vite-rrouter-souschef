// tests/profile.test.ts
import request from "supertest";
import app from "../app";
import { User } from "../types/entities/User";
import { createTestUser } from "./test-utils";
import pool from "../config/database";
import { initializeDatabase } from "../config/schema";

describe("GET /profile", () => {
  let testUser: User;

  beforeAll(async () => {
    await initializeDatabase();
    testUser = await createTestUser();
  });

  it("should return 401 if not authenticated", async () => {
    const res = await request(app).get("/profile");
    expect(res.status).toBe(401);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [testUser.id]);
  });
});
