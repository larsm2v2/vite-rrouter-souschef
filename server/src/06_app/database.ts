import pool from "../05_frameworks/database/connection";
import { initializeDatabase } from "../05_frameworks/database/schema";

/**
 * Ensures the database is connected and initialized.
 * First attempts to connect and verify tables exist.
 * If tables don't exist, runs schema initialization.
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

  // Then verify schema is initialized
  try {
    await pool.query("SELECT 1 FROM users LIMIT 1");
    console.log("✅ Database schema already initialized");
  } catch (error) {
    console.warn(
      "⚠️ Database schema not initialized. Running initializeDatabase()..."
    );
    try {
      await initializeDatabase();
      console.log("✅ Database schema initialization completed");
    } catch (initError) {
      console.error("❌ Database schema initialization failed:", initError);
      throw new Error(
        `Schema initialization failed: ${
          (initError as Error).message || initError
        }`
      );
    }
  }
}
