import { pool } from "..";
import { migrateAddProfileFeatures } from "../../../migrations/add_profile_features";

export async function migrateRecipeTables() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Existing migrations may run here. Call profile features migration as part of migration runner.
    await migrateAddProfileFeatures();

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
