import pool from "../05_frameworks/database/connection";
import { initializeDatabase } from "../05_frameworks/database/schema";

export async function ensureDatabaseInitialized() {
  try {
    await pool.query("SELECT 1 FROM users LIMIT 1");
    console.log("✅ Database already initialized.");
  } catch (error) {
    console.warn(
      "⚠️ Database not initialized. Running initializeDatabase()..."
    );
    await initializeDatabase();
  }
}
