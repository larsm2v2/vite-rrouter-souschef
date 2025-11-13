// Ensure reflect-metadata and DI are initialized before importing application
import "reflect-metadata";
import "../04_factories/di"; // boot DI container and register services

import { validateEnvironment } from "./environment";
import { startServer } from "./server";

async function main() {
  try {
    validateEnvironment();
    await startServer();
  } catch (error) {
    console.error("❌ Application failed to start:", error);
    process.exit(1);
  }
}

main();
