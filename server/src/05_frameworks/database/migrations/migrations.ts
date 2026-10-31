import { pool } from "..";
import { migrateAddProfileFeatures } from "../../../migrations/add_profile_features";
import { migrateAddRefreshTokens } from "../../../migrations/add_refresh_tokens";
import { migrateAddShareTokenIndex } from "../../../migrations/add_share_token_index";

export async function migrateRecipeTables() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Existing migrations may run here. Call profile features migration as part of migration runner.
    await migrateAddProfileFeatures();
    // Ensure refresh token allowlist table exists. This migration is idempotent.
    await migrateAddRefreshTokens();
    // Ensure the recipe share-token lookup index exists. This migration is idempotent.
    await migrateAddShareTokenIndex();

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
