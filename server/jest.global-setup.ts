// jest.global-setup.ts
import { initializeDatabase } from "./src/05_frameworks/database/schema";
import { testPool } from "./src/07_tests/test-config";
import { Pool } from "pg";

export default async () => {
  const adminPool = new Pool({
    user: process.env.PG_USER || "postgres",
    host: process.env.PG_HOST || "localhost",
    database: "postgres", // Connect to the default postgres database
    password: process.env.PG_PASSWORD || "your_password",
    port: parseInt(process.env.PG_PORT || "5432"),
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    // Check if the test database exists
    const dbName = process.env.PG_DATABASE || "SousChefDB";
    const result = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (result.rowCount === 0) {
      console.log(`Database ${dbName} does not exist. Creating...`);
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database ${dbName} created successfully`);
    } else {
      console.log(`Database ${dbName} already exists`);
    }

    // Verify connection to the test database
    await testPool.query("SELECT 1", []);
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
