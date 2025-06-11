// src/database.ts
import dotenv from "dotenv";
dotenv.config();
import { Pool } from "pg";

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      display_name: string;
    }
  }
}

async function ensureDatabaseExists() {
  const dbName = process.env.PG_DATABASE || "SousChefDB";

  // Connect to postgres database to check if our target DB exists
  const adminPool = new Pool({
    user: process.env.PG_USER || "postgres",
    host: process.env.PG_HOST || "localhost",
    database: "postgres", // Connect to default postgres database
    password: process.env.PG_PASSWORD || "tryhavok", // Using actual password from env
    port: parseInt(process.env.PG_PORT || "5432"),
    // No SSL for local admin connection
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    // Check if database exists
    const checkResult = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (checkResult.rowCount === 0) {
      console.log(`Database ${dbName} does not exist. Creating...`);
      // Need to avoid SQL injection even though this is coming from env vars
      // For PostgreSQL, we can't use parameters for the database name, so we need to validate it
      const validDbName = /^[a-zA-Z0-9_]+$/.test(dbName);

      if (!validDbName) {
        throw new Error(`Invalid database name: ${dbName}`);
      }

      // Create database - note we can't use parameters for DB names
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database ${dbName} created successfully`);
    } else {
      console.log(`Database ${dbName} already exists`);
    }
  } catch (err) {
    console.error("❌ Error ensuring database exists:", err);
    throw err;
  } finally {
    // Close admin connection
    await adminPool.end();
  }
}

const envTypes = ["test", "development", "production"];
const isTestEnv = process.env.NODE_ENV === "test";

// Fix: This function creates and exports the pool
async function createPool() {
  // Ensure database exists first (except in test environment)
  if (!isTestEnv) {
    try {
      await ensureDatabaseExists();
    } catch (err) {
      console.error("Failed to ensure database exists:", err);
      process.exit(1);
    }
  }

  // PostgreSQL configuration
  const pgConfig = isTestEnv
    ? {
        user: process.env.PG_USER || "postgres",
        host: process.env.PG_HOST_TEST || "localhost",
        database: process.env.PG_DATABASE_TEST || "ttlo_test",
        password: process.env.PG_PASSWORD || "tryhavok",
        port: parseInt(process.env.PG_PORT || "5432"),
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    : process.env.PG_URL
    ? {
        connectionString: process.env.PG_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    : {
        user: process.env.PG_USER || "postgres",
        host: process.env.PG_HOST || "localhost",
        database: process.env.PG_DATABASE || "SousChefDB", // FIXED: Changed TTLO to SousChefDB
        password: process.env.PG_PASSWORD || "tryhavok",
        port: parseInt(process.env.PG_PORT || "5432"),
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl:
          process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
      };

  // Create the pool AFTER ensuring the database exists
  const pool = new Pool(pgConfig);

  // Test the connection
  if (!isTestEnv) {
    try {
      const res = await pool.query("SELECT NOW() as now");
      console.log("✅ PostgreSQL connected at", res.rows[0].now);
    } catch (err) {
      console.error("❌ PostgreSQL connection error:", err);
      process.exit(1);
    }
  }

  return pool;
}

// Create and export a promise that resolves to the pool
const poolPromise = createPool();
// Export a singleton pool instance
let pool: Pool;

// Default export is the pool instance
export default {
  query: async (...args: any[]) => {
    if (!pool) {
      pool = await poolPromise;
    }
    return pool.query(...args);
  },
  connect: async () => {
    if (!pool) {
      pool = await poolPromise;
    }
    return pool.connect();
  },
  // Add other methods you need from the pool
};
