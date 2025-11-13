import db from "../05_frameworks/database/connection";

/**
 * Migration: add_profile_features (version 3)
 * - Adds profile-related columns to recipes and users
 * - Creates meal_plan, shopping_list_versions, recipe_activity_log tables
 * - Creates helpful indexes
 *
 * This migration is idempotent and records its application in schema_version.
 */
export async function migrateAddProfileFeatures() {
  const client = await db.connect();
  try {
    // Ensure schema_version table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id SERIAL PRIMARY KEY,
        version INTEGER NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Check if this version is already applied
    const res = await client.query(
      `SELECT 1 FROM schema_version WHERE version = 3 LIMIT 1;`
    );
    if (res.rows.length > 0) {
      console.log(
        "Migration add_profile_features (v3) already applied, skipping."
      );
      return;
    }

    await client.query("BEGIN");

    // Add columns to recipes
    await client.query(`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS cooking_dates JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS photo_url TEXT,
      ADD COLUMN IF NOT EXISTS share_token TEXT;
    `);

    // Add columns to users
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS dietary_preferences TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS favorite_cuisines TEXT[] DEFAULT '{}';
    `);

    // Create meal_plan
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

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_meal_plan_user_date ON meal_plan(user_id, planned_date DESC);`
    );

    // Create shopping_list_versions
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

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_shopping_list_user_current ON shopping_list_versions(user_id, is_current);`
    );

    // Create recipe_activity_log
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

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_activity_log_user ON recipe_activity_log(user_id, created_at DESC);`
    );

    // Insert schema version record
    await client.query(`INSERT INTO schema_version (version) VALUES (3);`);

    await client.query("COMMIT");
    console.log("Migration add_profile_features (v3) applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration add_profile_features (v3) failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

// If this file is executed directly, run the migration
if (require.main === module) {
  migrateAddProfileFeatures()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
