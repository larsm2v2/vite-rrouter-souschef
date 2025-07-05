import { pool } from "..";

export async function migrateRecipeTables() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Migration logic here...

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
