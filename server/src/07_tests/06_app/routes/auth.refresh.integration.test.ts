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
      [testEmail],
    );
  });

  it("rotates refresh token and returns new access token", async () => {
    // Register a new user which sets refreshToken cookie
    const registerRes = await request(app)
      .post("/auth/register")
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
      c.startsWith("refreshToken="),
    );
    expect(cookieHeader).toBeDefined();
    // Send refresh with cookie
    const refreshRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", cookieHeader)
      .send({});

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
  });

  describe("rate limits", () => {
    it("lets a session renew many times (reloads, several devices) but keeps login strictly limited", async () => {
      const ip = "10.30.0.1";
      const registered = await request(app)
        .post("/auth/register")
        .set("X-Forwarded-For", ip)
        .send({
          email: `limit-${Date.now()}@example.com`,
          password: testPassword,
          display_name: "Limit Tester",
        });
      const header = registered.header["set-cookie"];
      const cookie = (Array.isArray(header) ? header : [header]).find((c: string) =>
        c.startsWith("refreshToken="),
      ) as string;

      // far more than the old shared cap of 5 per 15 minutes
      for (let i = 0; i < 12; i++) {
        const res = await request(app)
          .post("/auth/refresh")
          .set("X-Forwarded-For", ip)
          .set("Cookie", cookie)
          .send({});
        expect(res.status).toBe(200);
      }

      // password guessing is still capped: 5 per window, the 6th is rejected
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await request(app)
          .post("/auth/login")
          .set("X-Forwarded-For", "10.30.0.2")
          .send({ email: "nobody@example.com", password: "wrong-password" });
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 5).every((s) => s !== 429)).toBe(true);
      expect(statuses[5]).toBe(429);
    });

    afterAll(async () => {
      await db.query("DELETE FROM users WHERE email LIKE 'limit-%@example.com'");
    });
  });

  describe("reuse grace window", () => {
    // The auth limiter allows 5 requests per IP, so every test simulates its own client.
    let ipCounter = 0;
    const nextIp = () => `10.20.0.${++ipCounter}`;
    const cookieOf = (res: request.Response) => {
      const header = res.header["set-cookie"];
      const list = Array.isArray(header) ? header : [header].filter(Boolean);
      return list.find((c: string) => c.startsWith("refreshToken=")) as string;
    };
    const login = async (ip: string) =>
      cookieOf(
        await request(app)
          .post("/auth/register")
          .set("X-Forwarded-For", ip)
          .send({
            email: `grace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`,
            password: testPassword,
            display_name: "Grace Tester",
          }),
      );
    const refresh = (cookie: string, ip: string) =>
      request(app)
        .post("/auth/refresh")
        .set("X-Forwarded-For", ip)
        .set("Cookie", cookie)
        .send({});
    const jtiOf = (cookie: string) =>
      JSON.parse(
        Buffer.from(cookie.split("=")[1].split(".")[1], "base64url").toString(),
      ).jti as string;

    afterAll(async () => {
      await db.query("DELETE FROM users WHERE email LIKE 'grace-%@example.com'");
    });

    it("accepts a just-rotated token once more (lost response or a second tab)", async () => {
      const ip = nextIp();
      const original = await login(ip);
      expect((await refresh(original, ip)).status).toBe(200);
      // the original token was rotated, but presenting it again right away still works
      const again = await refresh(original, ip);
      expect(again.status).toBe(200);
      expect(again.body.accessToken).toBeDefined();
    });

    it("rejects a rotated token once the grace window has passed", async () => {
      const ip = nextIp();
      const original = await login(ip);
      await refresh(original, ip);
      await db.query(
        "UPDATE refresh_tokens SET revoked_at = NOW() - INTERVAL '5 minutes' WHERE jti = $1",
        [jtiOf(original)],
      );
      expect((await refresh(original, ip)).status).toBe(401);
    });

    it("makes logout final: no grace for a logged-out token", async () => {
      const ip = nextIp();
      const original = await login(ip);
      await request(app)
        .post("/auth/logout")
        .set("X-Forwarded-For", ip)
        .set("Cookie", original)
        .send({});
      expect((await refresh(original, ip)).status).toBe(401);
    });
  });
});
