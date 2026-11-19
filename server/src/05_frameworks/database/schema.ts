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
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT,
        is_checked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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
      ADD COLUMN IF NOT EXISTS favorite_cuisines TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS week_start_day INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS favorite_threshold INTEGER NOT NULL DEFAULT 3,
      ADD COLUMN IF NOT EXISTS planner_slots TEXT[] NOT NULL DEFAULT '{dinner}',
      ADD COLUMN IF NOT EXISTS household_size INTEGER NOT NULL DEFAULT 2;
    `);

    // Rotated refresh tokens stay valid briefly (revoked_at); existing databases
    // get the column here, new ones from the refresh_tokens migration.
    await client.query(`
      ALTER TABLE IF EXISTS refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;
    `);

    // Cooking history rollups used to rank favorites. favorite_locked is set
    // when the user manually unfavorites, so auto-favoriting never overrides it.
    await client.query(`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS cook_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_cooked_on DATE,
      ADD COLUMN IF NOT EXISTS favorite_locked BOOLEAN NOT NULL DEFAULT false;
    `);

    // Meal plan table for scheduling. recipe_id is SET NULL on recipe delete and
    // recipe_name is a snapshot, so past weeks survive deleting a recipe.
    await client.query(`
      CREATE TABLE IF NOT EXISTS meal_plan (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
        recipe_name TEXT,
        planned_date DATE NOT NULL,
        meal_type TEXT,
        is_cooked BOOLEAN DEFAULT false,
        cooked_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE meal_plan ADD COLUMN IF NOT EXISTS recipe_name TEXT;
    `);

    // kind = 'leftover' rows point at the planned meal that produced them and
    // are removed with it; multiplier scales the recipe for that planned meal.
    await client.query(`
      ALTER TABLE meal_plan
      ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'meal',
      ADD COLUMN IF NOT EXISTS source_entry_id INTEGER REFERENCES meal_plan(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS multiplier NUMERIC(3,1) NOT NULL DEFAULT 1;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_meal_plan_source ON meal_plan(source_entry_id);
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meal_plan_recipe_id_fkey' AND confdeltype <> 'n') THEN
          ALTER TABLE meal_plan DROP CONSTRAINT meal_plan_recipe_id_fkey;
          ALTER TABLE meal_plan ADD CONSTRAINT meal_plan_recipe_id_fkey
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await client.query(`
      UPDATE meal_plan mp SET recipe_name = r.name
      FROM recipes r WHERE r.id = mp.recipe_id AND mp.recipe_name IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_meal_plan_user_date ON meal_plan(user_id, planned_date DESC);
    `);

    // One row per recipe per day cooked, written by Cook Mode and by checking
    // off a planned meal.
    await client.query(`
      CREATE TABLE IF NOT EXISTS recipe_completions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        cooked_on DATE NOT NULL,
        source TEXT NOT NULL,
        meal_plan_id INTEGER REFERENCES meal_plan(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (user_id, recipe_id, cooked_on)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recipe_completions_recipe ON recipe_completions(recipe_id);
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
