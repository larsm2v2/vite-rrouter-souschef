import pool from "../05_frameworks/database/connection";

export async function up() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Running migration: add_recipe_images_update_grocery_list");

    // Check schema version
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const versionCheck = await client.query(
      "SELECT version FROM schema_version WHERE version = 4"
    );

    if (versionCheck.rows.length > 0) {
      console.log("Migration already applied, skipping...");
      await client.query("COMMIT");
      return; // Don't release here, let finally block handle it
    }

    // Create recipe_images table
    console.log("Creating recipe_images table...");
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

    // Backup existing grocery_list data
    console.log("Backing up grocery_list data...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS grocery_list_backup_v3 AS 
      SELECT * FROM grocery_list;
    `);

    // Drop old grocery_list table
    console.log("Dropping old grocery_list table...");
    await client.query(`DROP TABLE IF EXISTS grocery_list CASCADE;`);

    // Create new grocery_list table with improved structure
    console.log("Creating new grocery_list table with aggregation support...");
    await client.query(`
      CREATE TABLE grocery_list (
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

    // Record migration
    await client.query(
      "INSERT INTO schema_version (version) VALUES (4) ON CONFLICT (version) DO NOTHING"
    );

    await client.query("COMMIT");
    console.log("✅ Migration completed successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log(
      "Rolling back migration: add_recipe_images_update_grocery_list"
    );

    // Drop new tables
    await client.query(`DROP TABLE IF EXISTS recipe_images CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS grocery_list CASCADE;`);

    // Restore old grocery_list from backup if it exists
    const backupExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'grocery_list_backup_v3'
      );
    `);

    if (backupExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE grocery_list AS 
        SELECT * FROM grocery_list_backup_v3;
      `);
      await client.query(`DROP TABLE grocery_list_backup_v3;`);
    }

    // Remove version record
    await client.query("DELETE FROM schema_version WHERE version = 4");

    await client.query("COMMIT");
    console.log("✅ Rollback completed successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Rollback failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

// Auto-run migration if executed directly
if (require.main === module) {
  up()
    .then(() => {
      console.log("Migration completed");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
