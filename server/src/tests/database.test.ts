// tests/database.test.ts
process.env.NODE_ENV = "test";

import pool from "../config/database";
import { initializeDatabase } from "../config/schema";

describe("Database Operations", () => {
  let userId: number;
  let recipeId: number;
  let googleSub: string;

  beforeAll(async () => {
    try {
      // Initialize database tables
      await initializeDatabase();

      // Generate unique values for this test run
      googleSub = `test-google-id-${Date.now()}`;
      const email = `test-${Date.now()}@example.com`;
      const uniqueId = Date.now(); // Use timestamp for uniqueness
      const slug = `test-recipe-${Date.now()}`;

      console.log("Creating test user...");
      // Insert a test user first
      const userResult = await pool.query(
        `INSERT INTO users (google_sub, display_name, email)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [googleSub, "Test User", email]
      );

      userId = userResult.rows[0].id;
      console.log(`Created test user with ID: ${userId}`);

      console.log("Creating test recipe...");
      // Insert a test recipe with the user_id
      const recipeResult = await pool.query(
        `INSERT INTO recipes (user_id, unique_id, name, slug, cuisine, meal_type, dietary_restrictions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          userId,
          uniqueId,
          "Test Recipe",
          slug,
          "Italian",
          "Dinner",
          "{Vegetarian}",
        ]
      );

      recipeId = recipeResult.rows[0].id;
      console.log(`Created test recipe with ID: ${recipeId}`);

      console.log("Creating grocery list item...");
      // Insert a test grocery list item with both IDs
      await pool.query(
        `INSERT INTO grocery_list (user_id, recipe_id, item_name, quantity, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, recipeId, "Tomatoes", 2, "kg"]
      );
      console.log("Test setup completed successfully");
    } catch (err) {
      console.error("Test setup failed:", err);
      throw err;
    }
  });

  afterAll(async () => {
    try {
      console.log("Cleaning up test data...");
      // Delete in correct order to respect foreign key constraints
      await pool.query("DELETE FROM grocery_list WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM recipes WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
      console.log("Test data cleaned up successfully");
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  });

  it("should retrieve a user by google_sub", async () => {
    const result = await pool.query(
      "SELECT * FROM users WHERE google_sub = $1",
      [googleSub]
    );
    const user = result.rows[0];

    expect(user).toBeDefined();
    expect(user.display_name).toBe("Test User");
  });

  it("should create a new user", async () => {
    const newGoogleSub = `new-google-id-${Date.now()}`;
    const newEmail = `new-${Date.now()}@example.com`;

    const result = await pool.query(
      `INSERT INTO users (google_sub, display_name, email)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [newGoogleSub, "New User", newEmail]
    );
    const user = result.rows[0];

    expect(user).toBeDefined();
    expect(user.email).toBe(newEmail);

    // Clean up this specific test user
    await pool.query("DELETE FROM users WHERE google_sub = $1", [newGoogleSub]);
  });

  it("should associate recipes with users", async () => {
    const groceryResult = await pool.query(
      `INSERT INTO grocery_list (user_id, recipe_id, item_name, quantity)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, recipeId, "Test Item", 2]
    );

    expect(groceryResult.rows[0].id).toBeDefined();
  });

  it("should retrieve recipes for a user", async () => {
    const result = await pool.query(
      "SELECT * FROM recipes WHERE user_id = $1",
      [userId]
    );
    const recipes = result.rows;

    expect(recipes).toBeDefined();
    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes[0].name).toBe("Test Recipe");
  });

  it("should retrieve grocery list for a user", async () => {
    const result = await pool.query(
      "SELECT * FROM grocery_list WHERE user_id = $1",
      [userId]
    );
    const groceryList = result.rows;

    expect(groceryList).toBeDefined();
    expect(groceryList.length).toBeGreaterThan(0);
    expect(groceryList[0].item_name).toBe("Tomatoes");
  });
});
