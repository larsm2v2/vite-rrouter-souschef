import { app } from "../05_frameworks/index";
import { ensureDatabaseInitialized } from "./database";
import { Request, Response } from "express";

// Track application readiness state
let isReady = false;
let dbConnectionError: Error | null = null;

// Health endpoint - always returns 200 if server is running (for Cloud Run health checks)
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness endpoint - returns 200 only when DB is connected and ready
app.get("/ready", (req: Request, res: Response) => {
  if (isReady) {
    res.status(200).json({
      status: "ready",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: "not ready",
      database: "initializing",
      error: dbConnectionError?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export async function startServer() {
  // Start listening immediately so the container becomes healthy for Cloud Run
  // even if database initialization takes time or briefly fails.
  const PORT = process.env.PORT || 8000;
  const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
    console.log(`Readiness check available at http://localhost:${PORT}/ready`);
  });

  // Initialize database in the background with retry logic
  const initDB = async (retries = 5, delayMs = 2000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await ensureDatabaseInitialized();
        isReady = true;
        dbConnectionError = null;
        console.log(`✅ Database connected and ready (attempt ${attempt})`);
        return;
      } catch (err) {
        dbConnectionError = err as Error;
        console.error(
          `❌ Database initialization failed (attempt ${attempt}/${retries}):`,
          err
        );
        if (attempt < retries) {
          const delay = delayMs * Math.pow(2, attempt - 1); // exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    console.error(
      "⚠️ Database failed to initialize after all retries. Server will continue running but /ready will return 503."
    );
  };

  // Start DB initialization in background - don't block server startup
  initDB().catch((err) => {
    console.error("Database initialization process failed:", err);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    isReady = false; // Mark as not ready immediately
    server.close((err) => {
      if (err) {
        console.error("Error during server shutdown:", err);
        process.exit(1);
      }
      console.log("Server closed successfully");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}
