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
