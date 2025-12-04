// src/05_frameworks/database/schema.ts
import pool from "./connection";
import migrateRecipeTables from "../../migrations/create_recipe_tables";

let isInitializing = false;
let initializationPromise: Promise<void> | null = null;

async function createTables() {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_sub TEXT UNIQUE,
        email TEXT NOT NULL UNIQUE CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'),
        username TEXT UNIQUE,
        password TEXT,
        password_salt TEXT,
        display_name TEXT NOT NULL,
        avatar TEXT,
        google_access_token TEXT,
        google_refresh_token TEXT,
        token_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Recipes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS recipes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        unique_id BIGINT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        cuisine TEXT,
        meal_type TEXT,
        dietary_restrictions TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Recipe-related tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS recipe_serving_info (
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        prep_time TEXT,
        cook_time TEXT,
        total_time TEXT,
        servings INTEGER,
        PRIMARY KEY (recipe_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        ingredients JSONB NOT NULL,
        PRIMARY KEY (recipe_id, category)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recipe_instructions (
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        instruction TEXT NOT NULL,
        PRIMARY KEY (recipe_id, step_number)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recipe_notes (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        note TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recipe_nutrition (
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        nutrition_data JSONB NOT NULL,
        PRIMARY KEY (recipe_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recipe_images (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recipe_images_recipe ON recipe_images(recipe_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS grocery_list (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_name TEXT NOT NULL,
        category TEXT,
        total_quantity DECIMAL(10,2),
        unit TEXT,
        is_checked BOOLEAN DEFAULT FALSE,
        recipe_sources JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, item_name)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_grocery_list_user ON grocery_list(user_id, is_checked);
    `);

    // Add profile-related columns to recipes and users if they don't exist
    await client.query(`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS cooking_dates JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS photo_url TEXT,
      ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS dietary_preferences TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS favorite_cuisines TEXT[] DEFAULT '{}';
    `);

    // Meal plan table for scheduling
    await client.query(`
      CREATE TABLE IF NOT EXISTS meal_plan (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        planned_date DATE NOT NULL,
        meal_type TEXT,
        is_cooked BOOLEAN DEFAULT false,
        cooked_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_meal_plan_user_date ON meal_plan(user_id, planned_date DESC);
    `);

    // Shopping list versions with version history
    await client.query(`
      CREATE TABLE IF NOT EXISTS shopping_list_versions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        list_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        is_current BOOLEAN DEFAULT true
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shopping_list_user_current ON shopping_list_versions(user_id, is_current);
    `);

    // Already Stocked (recurring grocery items)
    await client.query(`
      CREATE TABLE IF NOT EXISTS already_stocked (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        stocked_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_already_stocked_user ON already_stocked(user_id);
    `);

    // Recipe activity log
    await client.query(`
      CREATE TABLE IF NOT EXISTS recipe_activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        activity_type TEXT NOT NULL,
        activity_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_log_user ON recipe_activity_log(user_id, created_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL CHECK (length(action) <= 50),
        endpoint TEXT NOT NULL CHECK (length(endpoint) <= 255),
        ip_address TEXT NOT NULL CHECK (length(ip_address) <= 45),
        user_agent TEXT CHECK (length(user_agent) <= 512),
        status_code INTEGER CHECK (status_code BETWEEN 100 AND 599),
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query("COMMIT");
    console.log("✅ Tables created successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating tables:", err);
    throw err;
  } finally {
    client.release();
  }
}

export async function initializeDatabase() {
  try {
    if (isInitializing) {
      return initializationPromise;
    }

    isInitializing = true;

    initializationPromise = createTables()
      .catch((err) => {
        console.error("Database initialization error:", err);
        throw err;
      })
      .finally(() => {
        isInitializing = false;
      });

    await initializationPromise;
    console.log("✅ Database schema initialization completed successfully");
  } catch (error) {
    console.error("❌ Error initializing database schema:", error);
    throw error;
  }
}

export default initializeDatabase;
