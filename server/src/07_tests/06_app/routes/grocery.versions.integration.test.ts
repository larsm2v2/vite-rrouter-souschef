import request from "supertest";
import { app } from "../../../05_frameworks/index";
import db from "../../../05_frameworks/database/connection";
import { generateAccessToken } from "../../../utils/jwt";

describe("grocery list versions (autosave contract)", () => {
  const email = `grocery-ver-${Date.now()}@example.com`;
  let userId: number;
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  const items = (...names: string[]) =>
    names.map((name) => ({ name, quantity: 1, unit: "", checked: false }));

  beforeAll(async () => {
    const u = await db.query(
      "INSERT INTO users (email, display_name) VALUES ($1, 'Ver') RETURNING id",
      [email],
    );
    userId = u.rows[0].id;
    token = generateAccessToken(userId, email, "Ver");
  });

  afterAll(async () => {
    await db.query("DELETE FROM shopping_list_versions WHERE user_id = $1", [
      userId,
    ]);
    await db.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("saves the body the client actually sends: { listData: [...] }", async () => {
    const res = await request(app)
      .post("/api/grocery-list/version")
      .set(auth())
      .send({ listData: items("apples") });
    expect(res.status).toBe(201);
    expect(res.body.version).toBeGreaterThanOrEqual(1);
    expect(res.body.listData).toEqual(items("apples"));
  });

  it("returns the saved list as the current version", async () => {
    const res = await request(app).get("/api/grocery-list/version").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.listData).toEqual(items("apples"));
    expect(res.body.isCurrent).toBe(true);
  });

  it("increments the version and keeps exactly one current row", async () => {
    const second = await request(app)
      .post("/api/grocery-list/version")
      .set(auth())
      .send({ listData: items("apples", "pears") });
    expect(second.status).toBe(201);
    const rows = await db.query(
      "SELECT version, is_current FROM shopping_list_versions WHERE user_id = $1 ORDER BY id",
      [userId],
    );
    const versions = rows.rows.map((r: { version: number }) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect(
      rows.rows.filter((r: { is_current: boolean }) => r.is_current),
    ).toHaveLength(1);
  });

  it("rejects a body that is not a list", async () => {
    for (const body of [
      {},
      { listData: "nope" },
      { listData: { a: 1 } },
      { listData: [1, 2] },
    ]) {
      const res = await request(app)
        .post("/api/grocery-list/version")
        .set(auth())
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it("rejects anonymous callers", async () => {
    const res = await request(app)
      .post("/api/grocery-list/version")
      .send({ listData: [] });
    expect(res.status).toBe(401);
  });

  describe("concurrency (baseVersion)", () => {
    it("accepts a save based on the current version", async () => {
      const current = await request(app)
        .get("/api/grocery-list/version")
        .set(auth());
      const res = await request(app)
        .post("/api/grocery-list/version")
        .set(auth())
        .send({
          listData: items("apples", "pears", "figs"),
          baseVersion: current.body.version,
        });
      expect(res.status).toBe(201);
    });

    it("rejects a stale save with 409 and returns the current list instead of overwriting it", async () => {
      const current = await request(app)
        .get("/api/grocery-list/version")
        .set(auth());
      const stale = current.body.version - 1;
      const res = await request(app)
        .post("/api/grocery-list/version")
        .set(auth())
        .send({ listData: items("overwrite"), baseVersion: stale });
      expect(res.status).toBe(409);
      expect(res.body.current.version).toBe(current.body.version);
      expect(res.body.current.listData).toEqual(current.body.listData);
      const after = await request(app)
        .get("/api/grocery-list/version")
        .set(auth());
      expect(after.body.listData).toEqual(current.body.listData);
    });

    it("a recipe added on the server makes an older client save conflict", async () => {
      const r = await db.query(
        "INSERT INTO recipes (user_id, unique_id, name, slug, cuisine, meal_type) VALUES ($1, $2, 'R', $3, 'x', 'dinner') RETURNING id",
        [userId, Date.now() * 1000 + 7, `ver-${Date.now()}`],
      );
      await db.query(
        "INSERT INTO recipe_ingredients (recipe_id, category, ingredients) VALUES ($1, 'default', $2)",
        [r.rows[0].id, JSON.stringify(["3 leeks"])],
      );
      const before = await request(app)
        .get("/api/grocery-list/version")
        .set(auth());
      const add = await request(app)
        .post(`/api/recipes/${r.rows[0].id}/add-to-grocery-list`)
        .set(auth())
        .send({});
      expect(add.status).toBe(200);
      const stale = await request(app)
        .post("/api/grocery-list/version")
        .set(auth())
        .send({
          listData: before.body.listData,
          baseVersion: before.body.version,
        });
      expect(stale.status).toBe(409);
      expect(JSON.stringify(stale.body.current.listData)).toContain("leek");
      await db.query("DELETE FROM recipes WHERE id = $1", [r.rows[0].id]);
    });

    it("two simultaneous saves from the same base: exactly one wins", async () => {
      const current = await request(app)
        .get("/api/grocery-list/version")
        .set(auth());
      const base = current.body.version;
      const [a, b] = await Promise.all([
        request(app)
          .post("/api/grocery-list/version")
          .set(auth())
          .send({ listData: items("a"), baseVersion: base }),
        request(app)
          .post("/api/grocery-list/version")
          .set(auth())
          .send({ listData: items("b"), baseVersion: base }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const rows = await db.query(
        "SELECT count(*)::int AS n FROM shopping_list_versions WHERE user_id = $1 AND is_current",
        [userId],
      );
      expect(rows.rows[0].n).toBe(1);
    });

    it("rejects a non-integer baseVersion", async () => {
      const res = await request(app)
        .post("/api/grocery-list/version")
        .set(auth())
        .send({ listData: items("x"), baseVersion: "abc" });
      expect(res.status).toBe(400);
    });
  });
});
