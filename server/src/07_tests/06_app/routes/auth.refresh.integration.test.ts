import request from "supertest";
import { app } from "../../../05_frameworks/index";
import db from "../../../05_frameworks/database/connection";

describe("POST /auth/refresh", () => {
  const testEmail = `refresh-test-${Date.now()}@example.com`;
  const testPassword = "P@ssw0rd!";

  afterAll(async () => {
    // Cleanup any created user
    await db.query("DELETE FROM users WHERE email = $1", [testEmail]);
    await db.query(
      "DELETE FROM refresh_tokens WHERE user_id = (SELECT id FROM users WHERE email = $1)",
      [testEmail]
    );
  });

  it("rotates refresh token and returns new access token", async () => {
    // Register a new user which sets refreshToken cookie
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: testEmail,
        password: testPassword,
        display_name: "Refresh Tester",
      })
      .set("Content-Type", "application/json");

    expect(registerRes.status).toBe(201);
    expect(registerRes.header["set-cookie"]).toBeDefined();

    // Extract cookie header - can be string or string[] depending on supertest
    const setCookieHeader = registerRes.header["set-cookie"];
    const setCookieArray = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader].filter(Boolean);
    const cookieHeader = setCookieArray.find((c: string) =>
      c.startsWith("refreshToken=")
    );
    expect(cookieHeader).toBeDefined();
    // Send refresh with cookie
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieHeader)
      .send({});

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
  });
});
