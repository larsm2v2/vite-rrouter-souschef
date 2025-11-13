import db from "../05_frameworks/database/connection";

export async function migrateAddRefreshTokens() {
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
      `SELECT 1 FROM schema_version WHERE version = 4 LIMIT 1;`
    );
    if (res.rows.length > 0) {
      console.log(
        "Migration add_refresh_tokens (v4) already applied, skipping."
      );
      return;
    }

    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        jti TEXT UNIQUE NOT NULL,
        token TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        revoked BOOLEAN DEFAULT FALSE
      );
    `);

    await client.query(`INSERT INTO schema_version (version) VALUES (4);`);

    await client.query("COMMIT");
    console.log("Migration add_refresh_tokens (v4) applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration add_refresh_tokens (v4) failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrateAddRefreshTokens()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
