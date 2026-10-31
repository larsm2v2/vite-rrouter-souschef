import db from "../05_frameworks/database/connection";

/**
 * Migration: add_share_token_index (version 5)
 * - The `share_token` column on `recipes` already exists (added via the
 *   idempotent ALTER TABLE in `05_frameworks/database/schema.ts`) but has no
 *   dedicated index for fast lookups by token. Adds a partial unique index
 *   so token lookups (`WHERE share_token = $1`) stay fast as the table grows.
 *
 * This migration is idempotent and records its application in schema_version.
 */
export async function migrateAddShareTokenIndex() {
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

    // If migration already applied, skip
    const res = await client.query(
      `SELECT 1 FROM schema_version WHERE version = 5 LIMIT 1;`,
    );
    if (res.rows.length > 0) {
      console.log(
        "Migration add_share_token_index (v5) already applied, skipping.",
      );
      return;
    }

    await client.query("BEGIN");

    // Ensure the column exists (defensive; schema.ts already adds it) then
    // add a partial unique index for fast, non-null token lookups.
    await client.query(`
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS share_token TEXT;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_share_token
      ON recipes(share_token)
      WHERE share_token IS NOT NULL;
    `);

    await client.query(`INSERT INTO schema_version (version) VALUES (5);`);

    await client.query("COMMIT");
    console.log("Migration add_share_token_index (v5) applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration add_share_token_index (v5) failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrateAddShareTokenIndex()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
