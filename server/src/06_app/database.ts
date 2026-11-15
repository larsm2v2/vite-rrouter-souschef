import pool from "../05_frameworks/database/connection";
import { initializeDatabase } from "../05_frameworks/database/schema";

/**
 * Ensures the database is connected and its schema is up to date.
 * Throws error if database is unreachable or initialization fails.
 */
export async function ensureDatabaseInitialized() {
  // First verify we can connect to the database
  try {
    await pool.query("SELECT 1");
    console.log("✅ Database connection successful");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw new Error(
      `Database unreachable: ${(error as Error).message || error}`
    );
  }

  // The schema is fully idempotent (CREATE ... IF NOT EXISTS), so apply it on
  // every start. Checking only for `users` left databases created before newer
  // tables (e.g. recipe_images) permanently missing them, which made saving
  // recipes with images fail with a 500.
  try {
    await initializeDatabase();
    console.log("✅ Database schema verified");
  } catch (initError) {
    console.error("❌ Database schema initialization failed:", initError);
    throw new Error(
      `Schema initialization failed: ${
        (initError as Error).message || initError
      }`
    );
  }
}
