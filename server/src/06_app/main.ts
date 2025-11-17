// Load environment variables first
import dotenv from "dotenv";
dotenv.config(); // Load .env
dotenv.config({ path: ".env.local", override: true }); // Load .env.local (overrides .env)

// Ensure reflect-metadata and DI are initialized before importing application
import "reflect-metadata";
import "../04_factories/di"; // boot DI container and register services

import { validateEnvironment } from "./environment";
import { startServer } from "./server";
import migrateRunner from "../05_frameworks/database/migrations/migrations";
// Load runtime secret helper (fetches secrets from Secret Manager and caches them)
import { startupCache, scheduleRefresh } from "../secret-manager-example";

async function main() {
  try {
    console.log("🚀 Starting application, NODE_ENV=", process.env.NODE_ENV);
    validateEnvironment();

    // Secrets are now mounted as environment variables in Cloud Run via --set-secrets,
    // so we don't need to fetch them at runtime. Commented out to speed up startup.
    // If you need runtime secret rotation, uncomment this block and ensure GCP_PROJECT is set.
    /*
    try {
      await startupCache();
      // Start a background refresh loop to pick up rotations periodically
      scheduleRefresh();
    } catch (e) {
      console.warn(
        "Warning: secret manager startup cache failed, continuing to start server:",
        e
      );
    }
    */

    // Optionally run migrations automatically in production with a controlled
    // flag. Cloud Build can set RUN_MIGRATIONS=true for a single deploy which
    // will trigger the migration runner before the server starts accepting
    // traffic. This is intentional to allow first-time deployments to apply
    // idempotent schema migrations.
    if (process.env.RUN_MIGRATIONS === "true") {
      console.log(
        "RUN_MIGRATIONS=true - running migration runner before start"
      );
      try {
        await migrateRunner();
        console.log("✅ Migrations applied (RUN_MIGRATIONS)");
      } catch (err) {
        console.error("Migration runner failed:", err);
        // Don't block startup forever - continue and let Cloud Run healthchecks
        // fail if something is wrong. Operator alerting should pick this up.
      }
    }

    await startServer();
  } catch (error) {
    console.error("❌ Application failed to start:", error);
    process.exit(1);
  }
}

main();
