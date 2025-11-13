// jest.setup.ts
import "reflect-metadata"; // required by tsyringe in tests
import { initializeDatabase } from "./src/05_frameworks/database/schema";
import pool from "./src/05_frameworks/database/connection";

export default async function setup() {
  // Set test environment
  process.env.NODE_ENV = "test";

  try {
    // Initialize database schema
    await initializeDatabase();

    // Clean up any existing test data
    await pool.query("DELETE FROM audit_log");
    await pool.query("DELETE FROM users");

    console.log("✅ Test setup completed");
  } catch (err) {
    console.error("❌ Test setup failed:", err);
    throw err;
  }
}

// jest.config.js
module.exports = {
  // Your existing config...
  forceExit: true,
  detectOpenHandles: true,
  // Add a longer timeout if needed
  testTimeout: 30000,
};
