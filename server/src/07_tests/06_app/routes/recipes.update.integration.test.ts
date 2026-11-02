import request from "supertest";
import { app } from "../../../05_frameworks/index";
import db from "../../../05_frameworks/database/connection";
import { generateAccessToken } from "../../../utils/jwt";

describe("PUT /api/recipes/:id", () => {
  const ownerEmail = `recipe-edit-${Date.now()}@example.com`;
  const otherEmail = `recipe-edit-other-${Date.now()}@example.com`;
  let ownerId: number;
  let otherId: number;
  let recipeId: number;
  let ownerToken: string;
  let otherToken: string;
  let uniqueId: number;
  let slug: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const owner = await db.query(
      "INSERT INTO users (email, display_name) VALUES ($1, 'Edit Owner') RETURNING id",
      [ownerEmail],
    );
    const other = await db.query(
      "INSERT INTO users (email, display_name) VALUES ($1, 'Other User') RETURNING id",
      [otherEmail],
    );
    ownerId = owner.rows[0].id;
    otherId = other.rows[0].id;
    ownerToken = generateAccessToken(ownerId, ownerEmail, "Edit Owner");
    otherToken = generateAccessToken(otherId, otherEmail, "Other User");
    uniqueId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    slug = `recipe-edit-${uniqueId}`;
    const recipe = await db.query(
      `INSERT INTO recipes (user_id, unique_id, name, slug, cuisine, meal_type, dietary_restrictions, is_favorite)
       VALUES ($1, $2, 'Before edit', $3, 'Old cuisine', 'lunch', ARRAY['old'], true)
       RETURNING id`,
      [ownerId, uniqueId, slug],
    );
    recipeId = recipe.rows[0].id;
    await db.query(
      `INSERT INTO recipe_serving_info (recipe_id, prep_time, cook_time, total_time, servings)
       VALUES ($1, '5 min', '10 min', '15 min', 2)`,
      [recipeId],
    );
    await db.query(
      "INSERT INTO recipe_ingredients (recipe_id, category, ingredients) VALUES ($1, 'default', $2)",
      [recipeId, JSON.stringify(["1 cup flour"])],
    );
    await db.query(
      "INSERT INTO recipe_instructions (recipe_id, step_number, instruction) VALUES ($1, 1, 'Mix')",
      [recipeId],
    );
    await db.query(
      "INSERT INTO recipe_notes (recipe_id, note) VALUES ($1, 'Old note')",
      [recipeId],
    );
    await db.query(
      "INSERT INTO recipe_nutrition (recipe_id, nutrition_data) VALUES ($1, $2)",
      [recipeId, JSON.stringify({ calories: "100" })],
    );
    await db.query(
      "INSERT INTO recipe_images (recipe_id, image_url, is_primary) VALUES ($1, 'private-image', true)",
      [recipeId],
    );
  });

  afterAll(async () => {
    await db.query("DELETE FROM recipes WHERE id = $1", [recipeId]);
    await db.query("DELETE FROM users WHERE id = ANY($1)", [
      [ownerId, otherId],
    ]);
  });

  it("replaces editable fields and child rows, preserving identifiers and non-editor state", async () => {
    const res = await request(app)
      .put(`/api/recipes/${recipeId}`)
      .set(auth(ownerToken))
      .send({
        name: "After edit",
        cuisine: "New cuisine",
        mealType: "dinner",
        dietaryRestrictions: ["vegetarian"],
        servingInfo: {
          prepTime: "8 min",
          cookTime: "12 min",
          totalTime: "20 min",
          servings: 4,
        },
        ingredients: {
          default: [
            "2 cups flour",
            { id: 4, name: "salt", quantity: 1, unit: "tsp" },
          ],
          sauce: ["1 tbsp oil"],
        },
        instructions: [
          { number: 1, text: "Combine." },
          { number: 2, text: "Bake." },
        ],
        notes: ["New note"],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const saved = await request(app)
      .get(`/api/recipes/${recipeId}`)
      .set(auth(ownerToken));
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      id: String(recipeId),
      unique_id: String(uniqueId),
      name: "After edit",
      cuisine: "New cuisine",
      meal_type: "dinner",
      dietary_restrictions: ["vegetarian"],
      is_favorite: true,
      serving_info: {
        prep_time: "8 min",
        cook_time: "12 min",
        total_time: "20 min",
        servings: 4,
      },
      ingredients: {
        default: [
          "2 cups flour",
          { id: 4, name: "salt", quantity: 1, unit: "tsp" },
        ],
        sauce: ["1 tbsp oil"],
      },
      instructions: [
        { number: 1, text: "Combine." },
        { number: 2, text: "Bake." },
      ],
      notes: ["New note"],
      nutrition: { calories: "100" },
    });
    expect(saved.body.slug).toBeUndefined();
    const image = await db.query(
      "SELECT image_url, is_primary FROM recipe_images WHERE recipe_id = $1",
      [recipeId],
    );
    expect(image.rows).toEqual([
      { image_url: "private-image", is_primary: true },
    ]);
  });

  it("does not update a recipe owned by another user", async () => {
    const res = await request(app)
      .put(`/api/recipes/${recipeId}`)
      .set(auth(otherToken))
      .send({
        name: "Not yours",
        ingredients: {},
        instructions: [],
        notes: [],
      });
    expect(res.status).toBe(404);
    const saved = await db.query("SELECT name FROM recipes WHERE id = $1", [
      recipeId,
    ]);
    expect(saved.rows[0].name).toBe("After edit");
  });

  it("rejects anonymous and invalid requests", async () => {
    const anonymous = await request(app)
      .put(`/api/recipes/${recipeId}`)
      .send({ name: "No token", ingredients: {}, instructions: [], notes: [] });
    expect(anonymous.status).toBe(401);

    const invalid = await request(app)
      .put(`/api/recipes/${recipeId}`)
      .set(auth(ownerToken))
      .send({ name: "", ingredients: {}, instructions: [], notes: [] });
    expect(invalid.status).toBe(400);
  });
});
