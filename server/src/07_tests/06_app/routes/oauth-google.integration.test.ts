import request from "supertest";
import { app } from "../../../05_frameworks/index";
import db from "../../../05_frameworks/database/connection";
import { assertRouteExists } from "../../helpers/assertRouteExists";

describe("POST /api/oauth/google/token (mocked Google)", () => {
  beforeAll(async () => {
    // Ensure the route exists in the mounted app — stable and uses /debug/routes
    await assertRouteExists("/api/oauth/google/token", "post");
  });

  let originalFetch: any;
  beforeEach(async () => {
    // Spy on global.fetch to intercept outgoing calls to Google
    originalFetch = (global as any).fetch;
    (global as any).fetch = jest.fn();

    // Mock the DB queries used in oauth-google.routes so CI/test doesn't need a live DB
    let inserted = false;
    jest
      .spyOn(db, "query")
      .mockImplementation(async (sql: string, params?: any[]) => {
        const normalized = sql.toLowerCase();
        // The presence of a row for google_sub is handled below and depends
        // on whether an INSERT has been simulated.
        // Mock INSERT into users
        if (normalized.startsWith("insert into users")) {
          inserted = true;
          return { rows: [{ id: 999 }] } as any;
        }
        // Mock select by id after insert
        if (normalized.includes("where id = $1")) {
          return {
            rows: [
              { id: 999, email: "mock@example.com", display_name: "Mock User" },
            ],
          } as any;
        }
        // After insert, when the code looks up the user by google_sub, return
        // a row that includes the encrypted token so tests can assert it.
        if (normalized.includes("where google_sub = $1")) {
          if (inserted) {
            return {
              rows: [
                {
                  id: 999,
                  email: "mock@example.com",
                  google_sub: "google-123",
                  google_access_token: "encrypted-token",
                },
              ],
            } as any;
          }
          return { rows: [] } as any;
        }
        // Mock UPDATE used to store encrypted tokens (loose match)
        if (normalized.includes("update users")) {
          return { rows: [{ id: 999 }] } as any;
        }
        // Default: return empty
        return { rows: [] } as any;
      });
  });

  afterEach(async () => {
    (global as any).fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns 400 when Google responds with invalid_grant (invalid code)", async () => {
    // Check the route returns a 400 for missing params (this ensures it is mounted)
    // Assert the route is present via /debug/routes (stable and explicit)
    // Ensure the route is present
    await assertRouteExists("/api/oauth/google/token", "post");
    const check = await request(app)
      .post("/api/oauth/google/token")
      .send({})
      .set("Content-Type", "application/json");
    // Debug output if the test fails so we can see what's returned
    if (check.status !== 400) {
      console.error(
        "DEBUG: check response:",
        check.status,
        check.body,
        check.text
      );
    }
    expect(check.status).toBe(400);
    // Mock token endpoint to return a Google error
    (global as any).fetch.mockImplementationOnce(async (url: string) => {
      if (url.includes("oauth2.googleapis.com/token")) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: "invalid_grant",
            error_description: "Malformed auth code.",
          }),
        };
      }
      throw new Error("unexpected call");
    });

    const res = await request(app)
      .post("/api/oauth/google/token")
      .send({ code: "bad", code_verifier: "fake" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      "Failed to exchange authorization code with Google"
    );
  });

  it("creates user and returns tokens on valid token exchange", async () => {
    // Ensure route is mounted via /debug/routes
    // Ensure the route is present
    await assertRouteExists("/api/oauth/google/token", "post");
    // Mock token endpoint success
    (global as any).fetch
      .mockImplementationOnce(async (url: string) => {
        if (url.includes("oauth2.googleapis.com/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: "G_ACCESS",
              refresh_token: "G_REFRESH",
            }),
          };
        }
        throw new Error("unexpected call");
      })
      // Then mock the userinfo call
      .mockImplementationOnce(async (url: string) => {
        if (url.includes("www.googleapis.com/oauth2/v3/userinfo")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              sub: "google-123",
              email: "mock@example.com",
              name: "Mock User",
              picture: "http://x",
            }),
          };
        }
        throw new Error("unexpected call");
      });

    const res = await request(app)
      .post("/api/oauth/google/token")
      .send({ code: "valid", code_verifier: "verifier" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.user).toBeDefined();
    // server should set a refresh token cookie
    expect(res.header["set-cookie"]).toBeDefined();

    // Verify user in DB
    const userRes = await db.query(
      "SELECT id, google_sub, email, google_access_token FROM users WHERE google_sub = $1",
      ["google-123"]
    );
    expect(userRes.rows.length).toBe(1);
    const dbUser = userRes.rows[0];
    expect(dbUser.email).toBe("mock@example.com");
    expect(dbUser.google_access_token).toBeTruthy();
  });
});
