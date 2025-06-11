// jest.global-setup.ts
import { initializeDatabase } from "./src/config/schema";
import { testPool } from "./src/config/test-config";

export default async () => {
  try {
    // Verify connection
    await testPool.query("SELECT 1");
    console.log("✅ Test database connected");

    // Initialize schema
    await initializeDatabase();
  } catch (err) {
    console.error("❌ Test database connection failed");
    console.error("Current DB config:", {
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      port: process.env.PG_PORT,
    });
    throw err;
  }
};
