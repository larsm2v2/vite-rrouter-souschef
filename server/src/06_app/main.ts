// Ensure reflect-metadata and DI are initialized before importing application
import "reflect-metadata";
import "../04_factories/di"; // boot DI container and register services

import { validateEnvironment } from "./environment";
import { startServer } from "./server";
// Load runtime secret helper (fetches secrets from Secret Manager and caches them)
import { startupCache, scheduleRefresh } from "../secret-manager-example";

async function main() {
  try {
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

    await startServer();
  } catch (error) {
    console.error("❌ Application failed to start:", error);
    process.exit(1);
  }
}

main();
