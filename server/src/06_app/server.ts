import { app } from "../05_frameworks/index";
import { ensureDatabaseInitialized } from "./database";

export async function startServer() {
  // Start listening immediately so the container becomes healthy for Cloud Run
  // even if database initialization takes time or briefly fails.
  const PORT = process.env.PORT || 8000;
  const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });

  // Initialize database in the background. If initialization fails, log the
  // error but keep the server running so Cloud Run health checks succeed and
  // we can surface errors via logs and retry logic.
  ensureDatabaseInitialized().catch((err) => {
    console.error("Database initialization failed (continuing to run):", err);
  });

  return server;
}
