import fs from "fs";
import path from "path";
import request from "supertest";
import { app } from "../../../05_frameworks/index";
import db from "../../../05_frameworks/database/connection";
import { generateAccessToken } from "../../../utils/jwt";

describe("POST /api/recipes/:id/add-to-grocery-list (blocker B2)", () => {
  const email = `grocery-b2-${Date.now()}@example.com`;
  let userId: number;
  let token: string;
  let stringRecipeId: number;
  let structuredRecipeId: number;

  const insertRecipe = async (name: string, ingredients: unknown[]) => {
    const unique = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const r = await db.query(
      "INSERT INTO recipes (user_id, unique_id, name, slug, cuisine, meal_type) VALUES ($1, $2, $3, $4, 'test', 'dinner') RETURNING id",
      [userId, unique, name, `b2-${unique}`],
    );
    await db.query(
      "INSERT INTO recipe_ingredients (recipe_id, category, ingredients) VALUES ($1, 'default', $2)",
      [r.rows[0].id, JSON.stringify(ingredients)],
    );
    return r.rows[0].id as number;
  };

  const currentList = async () => {
    const res = await request(app)
      .get("/api/grocery-list/version")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.listData as {
      name: string;
      quantity: number;
      unit: string;
      checked: boolean;
      sources?: string[];
    }[];
  };

  beforeAll(async () => {
    const u = await db.query(
      "INSERT INTO users (email, display_name) VALUES ($1, 'B2') RETURNING id",
      [email],
    );
    userId = u.rows[0].id;
    token = generateAccessToken(userId, email, "B2");
    stringRecipeId = await insertRecipe("String Soup", [
      "1 cup flour",
      "2 eggs",
      "salt, to taste",
      "250 ml milk",
    ]);
    structuredRecipeId = await insertRecipe("Structured Soup", [
      { id: 1, name: "flour", quantity: 1, unit: "cup" },
      { id: 2, name: "milk", quantity: 1, unit: "cup" },
    ]);
  });

  afterAll(async () => {
    await db.query("DELETE FROM shopping_list_versions WHERE user_id = $1", [
      userId,
    ]);
    await db.query("DELETE FROM recipes WHERE user_id = $1", [userId]);
    await db.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("accepts recipes whose ingredients are plain strings", async () => {
    const res = await request(app)
      .post(`/api/recipes/${stringRecipeId}/add-to-grocery-list`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    const list = await currentList();
    expect(list.find((i) => i.name === "flour")).toMatchObject({
      quantity: 1,
      unit: "cup",
    });
    expect(list.find((i) => i.name === "eggs")).toMatchObject({
      quantity: 2,
      unit: "",
    });
    expect(list.find((i) => i.name === "salt")).toMatchObject({ quantity: 0 });
  });

  it("sums into existing lines instead of overwriting, converting compatible units", async () => {
    const res = await request(app)
      .post(`/api/recipes/${structuredRecipeId}/add-to-grocery-list`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    const list = await currentList();
    const flour = list.filter((i) => i.name === "flour");
    expect(flour).toHaveLength(1);
    expect(flour[0].quantity).toBe(2);
    const milk = list.filter((i) => i.name === "milk");
    expect(milk).toHaveLength(1);
    // 250 ml + 1 cup stays in the existing line's unit (ml).
    expect(milk[0].quantity).toBeCloseTo(486.5882, 1);
    expect(milk[0].unit).toBe("ml");
    expect(milk[0].sources).toEqual(
      expect.arrayContaining([
        String(stringRecipeId),
        String(structuredRecipeId),
      ]),
    );
  });

  it("applies a serving scale to the amounts it adds", async () => {
    await db.query("DELETE FROM shopping_list_versions WHERE user_id = $1", [
      userId,
    ]);
    const res = await request(app)
      .post(`/api/recipes/${structuredRecipeId}/add-to-grocery-list`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scale: 2 });
    expect(res.status).toBe(200);
    const list = await currentList();
    expect(list.find((i) => i.name === "flour")?.quantity).toBe(2);
  });

  it("rejects a nonsensical scale", async () => {
    for (const scale of [0, -1, 1000, "abc"]) {
      const res = await request(app)
        .post(`/api/recipes/${structuredRecipeId}/add-to-grocery-list`)
        .set("Authorization", `Bearer ${token}`)
        .send({ scale });
      expect(res.status).toBe(400);
    }
  });

  it("increments the version number instead of always writing 1", async () => {
    const rows = await db.query(
      "SELECT version FROM shopping_list_versions WHERE user_id = $1 ORDER BY id",
      [userId],
    );
    const versions = rows.rows.map((r: { version: number }) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("does not let another user add from your recipe", async () => {
    const other = generateAccessToken(
      userId + 100000,
      "nobody@example.com",
      "Nobody",
    );
    const res = await request(app)
      .post(`/api/recipes/${structuredRecipeId}/add-to-grocery-list`)
      .set("Authorization", `Bearer ${other}`)
      .send({});
    expect(res.status).toBe(404);
  });
});

describe("shared logic stays in sync between client and server", () => {
  const pairs: [string, string][] = [
    ["recipeMath/quantity.ts", "recipeMath/quantity.ts"],
    ["recipeMath/units.ts", "recipeMath/units.ts"],
    ["recipeMath/ingredient.ts", "recipeMath/ingredient.ts"],
    ["groceryMerge.ts", "groceryMerge.ts"],
  ];
  const clientDir = path.join(process.cwd(), "..", "client", "src", "utils");
  const serverDir = path.join(process.cwd(), "src", "utils");
  const clientPresent = fs.existsSync(clientDir);

  it.each(pairs)(
    "%s is identical (run scripts/sync-shared-logic.ps1 if this fails)",
    (a, b) => {
      if (!clientPresent) return; // server-only checkout (for example inside the Docker build context)
      const client = fs
        .readFileSync(path.join(clientDir, a), "utf8")
        .replace(/\r\n/g, "\n");
      const server = fs
        .readFileSync(path.join(serverDir, b), "utf8")
        .replace(/\r\n/g, "\n");
      expect(server).toBe(client);
    },
  );
});
