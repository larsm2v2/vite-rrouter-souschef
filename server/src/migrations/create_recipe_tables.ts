import pool from "../config/database";

export async function migrateRecipeTables() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if schema_version table exists
    const schemaVersionResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_version'
      );
    `);

    if (!schemaVersionResult.rows[0].exists) {
      console.log("Creating schema_version table...");
      await client.query(`
        CREATE TABLE schema_version (
          version INT PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT NOW()
        );
      `);
    }

    // Check if recipe tables migration has been applied
    const versionResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM schema_version 
        WHERE version = 2
      );
    `);

    if (versionResult.rows[0].exists) {
      console.log("Recipe tables migration already applied. Skipping.");
      await client.query("COMMIT");
      return;
    }

    console.log("Creating recipe tables...");

    // Create tables using the schema we defined
    await client.query(`
      -- Main recipes table
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
      
      -- Serving information
      CREATE TABLE recipe_serving_info (
          recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
          prep_time TEXT,
          cook_time TEXT,
          total_time TEXT,
          servings INTEGER,
          PRIMARY KEY (recipe_id)
      );
      
      -- Ingredients stored as JSONB for flexibility
      CREATE TABLE recipe_ingredients (
          recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          ingredients JSONB NOT NULL,
          PRIMARY KEY (recipe_id, category)
      );
      
      -- Instructions as ordered steps
      CREATE TABLE recipe_instructions (
          recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
          step_number INTEGER NOT NULL,
          instruction TEXT NOT NULL,
          PRIMARY KEY (recipe_id, step_number)
      );
      
      -- Notes table
      CREATE TABLE recipe_notes (
          id SERIAL PRIMARY KEY,
          recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
          note TEXT NOT NULL
      );
      
      -- Nutrition information as JSONB
      CREATE TABLE recipe_nutrition (
          recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
          nutrition_data JSONB NOT NULL,
          PRIMARY KEY (recipe_id)
      );
      
      -- Create indexes for performance
      CREATE INDEX idx_recipes_cuisine ON recipes(cuisine);
      CREATE INDEX idx_recipes_meal_type ON recipes(meal_type);
      CREATE INDEX idx_recipes_dietary ON recipes USING GIN(dietary_restrictions);
    `);

    // Record that this migration has been applied
    await client.query(`
      INSERT INTO schema_version (version) VALUES (2);
    `);

    await client.query("COMMIT");
    console.log("✅ Recipe tables created successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating recipe tables:", err);
    throw err;
  } finally {
    client.release();
  }
}

export default migrateRecipeTables;
