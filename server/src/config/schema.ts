// src/schema.ts
import pool from "./database";
import migrateRecipeTables from "../migrations/create_recipe_tables";

// Add a lock to prevent concurrent initialization
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;

async function createTables() {
  const client = await pool.connect();
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

    // Recipe Information
    await client.query(`
      CREATE TABLE recipes (
        id SERIAL PRIMARY KEY,
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
    await client.query(`
      CREATE TABLE recipe_serving_info (
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        prep_time TEXT,
        cook_time TEXT,
        total_time TEXT,
        servings INTEGER,
        PRIMARY KEY (recipe_id)
      );
    `);

    await client.query(`
      CREATE TABLE recipe_ingredients (
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        category TEXT NOT NULL,  -- 'dish', 'sauce', 'marinade', etc.
        ingredients JSONB NOT NULL,
        PRIMARY KEY (recipe_id, category)
      );
    `);
    await client.query(`
      CREATE TABLE recipe_instructions (
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    PRIMARY KEY (recipe_id, step_number)
      );
    `);
    await client.query(`
      CREATE TABLE recipe_notes (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
    note TEXT NOT NULL
      );
    `);
    await client.query(`
    CREATE TABLE recipe_nutrition (
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
    nutrition_data JSONB NOT NULL,
    PRIMARY KEY (recipe_id)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Audit log
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

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
      CREATE INDEX IF NOT EXISTS idx_recipe_ingredients ON recipe_ingredients(recipe_id, category);
      CREATE INDEX IF NOT EXISTS idx_recipes_unique_id ON recipes(unique_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_action ON audit_log(user_id, action);
    `);

    // Comments
    await client.query(`
      COMMENT ON COLUMN users.google_sub IS 'Google OAuth subject identifier';
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
    // Return existing promise if already initializing
    if (isInitializing) {
      return initializationPromise;
    }

    // Set lock
    isInitializing = true;

    // Create new initialization promise
    initializationPromise = createTables()
      .catch((err) => {
        console.error("Database initialization error:", err);
        throw err;
      })
      .finally(() => {
        // Release lock
        isInitializing = false;
      });

    // Then migrate recipe tables
    await migrateRecipeTables();

    console.log("Database schema initialization completed successfully");
  } catch (error) {
    console.error("Error initializing database schema:", error);
    throw error;
  }
}

export default pool;
