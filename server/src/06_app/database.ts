import pool from "../config/database";
import { initializeDatabase } from "../config/schema";

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
