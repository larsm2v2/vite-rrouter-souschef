// src/05_frameworks/database/connection.ts
import dotenv from "dotenv";
dotenv.config();
import { Pool } from "pg";

// Note: Express.User type is defined centrally in src/types/express.d.ts

async function ensureDatabaseExists() {
  // Skip database creation for cloud databases (Neon, etc.) - they're already created
  if (process.env.PG_URL) {
    console.log(
      "Using cloud database (PG_URL), skipping database creation check"
    );
    return;
  }

  const dbName = process.env.PG_DATABASE || "SousChefDB";

  const adminPool = new Pool({
    user: process.env.PG_USER || "postgres",
    host: process.env.PG_HOST || "localhost",
    database: "postgres",
    password: process.env.PG_PASSWORD || "tryhavok",
    port: parseInt(process.env.PG_PORT || "5432"),
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    const checkResult = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (checkResult.rowCount === 0) {
      console.log(`Database ${dbName} does not exist. Creating...`);
      const validDbName = /^[a-zA-Z0-9_]+$/.test(dbName);

      if (!validDbName) {
        throw new Error(`Invalid database name: ${dbName}`);
      }

      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database ${dbName} created successfully`);
    } else {
      console.log(`Database ${dbName} already exists`);
    }
  } catch (err) {
    console.error("❌ Error ensuring database exists:", err);
    throw err;
  } finally {
    await adminPool.end();
  }
}

const isTestEnv = process.env.NODE_ENV === "test";

async function createPool() {
  if (!isTestEnv) {
    try {
      await ensureDatabaseExists();
    } catch (err) {
      console.error(
        "Failed to ensure database exists (continuing anyway):",
        err
      );
      // Don't exit - allow app to start and retry DB operations later
    }
  }

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
        // Increase connection timeout to give remote cloud DBs more time to respond
        connectionTimeoutMillis: 10000,
      }
    : {
        user: process.env.PG_USER || "postgres",
        host: process.env.PG_HOST || "localhost",
        database: process.env.PG_DATABASE || "SousChefDB",
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

  const pool = new Pool(pgConfig as any);

  // Don't test connection during pool creation to avoid blocking startup.
  // Connection will be tested on first query. This allows the HTTP server
  // to start and become healthy even if DB is temporarily unavailable.
  if (!isTestEnv) {
    console.log(
      "✅ PostgreSQL pool created (connection will be tested on first query)"
    );
  }

  return pool;
}

const poolPromise = createPool();
let internalPool: Pool | null;

const poolWrapper = {
  query: async (text: string, params?: any[]) => {
    if (!internalPool) {
      internalPool = await poolPromise;
    }
    return internalPool.query(text, params);
  },
  connect: async () => {
    if (!internalPool) {
      internalPool = await poolPromise;
    }
    return internalPool.connect();
  },
  end: async () => {
    if (internalPool) {
      console.log("Closing database pool connections...");
      const result = await internalPool.end();
      internalPool = null;
      console.log("Database pool connections closed");
      return result;
    }
    return null;
  },
};

export default poolWrapper;
// Backwards-compatible named export used elsewhere in the codebase
export const pool = poolWrapper;
