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

// Debug endpoint - shows registered routes
app.get("/debug/routes", (req: Request, res: Response) => {
  // Walk the middleware stack recursively and collect routes. This is more
  // robust than the previous implementation which missed nested routers in
  // some edge cases across environments.
  const routes: any[] = [];

  function walk(stack: any[], basePath = "") {
    stack.forEach((layer: any) => {
      try {
        if (layer.route) {
          // Direct route on app or router
          routes.push({
            path: basePath + (layer.route.path || ""),
            methods: Object.keys(layer.route.methods || {}),
          });
        } else if (
          layer.name === "router" &&
          layer.handle &&
          layer.handle.stack
        ) {
          // Router middleware: compute its prefix and dive into children
          const prefix =
            layer.regexp && layer.regexp.source
              ? layer.regexp.source
                  .replace("\\/?", "")
                  .replace("(?=\\/|$)", "")
                  .replace(/\\/g, "")
              : "";

          // If the prefix looks like ^\/api\/oauth\/?(?=\/|$) this will
          // convert it to /api/oauth
          const cleaned = prefix.replace(/\^|\$|\(|\)|\?=|\\/g, "");
          const newBase = (basePath + cleaned).replace(/\/\//g, "/");

          // Recurse into this router
          walk(layer.handle.stack, newBase);
        }
      } catch (ignore) {
        // Defensive - don't fail debug route because one middleware is odd
      }
    });
  }

  walk(app._router?.stack || []);

  res.json({
    totalMiddleware: app._router?.stack?.length || 0,
    routes: routes,
  });
});

// Debug: list all loaded modules that look like routes to detect tree-shaking
app.get("/debug/imported-modules", (req: Request, res: Response) => {
  try {
    const modules = Object.keys(require.cache || {}).filter(
      (k) => k.includes("/routes/") || k.includes("\\routes\\")
    );
    res.json({ count: modules.length, modules: modules.slice(0, 200) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
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

  // Diagnostic: print the full app router paths on startup for Cloud Run logs
  try {
    const list: any[] = [];
    (app._router?.stack || []).forEach((layer: any) => {
      if (layer.route) {
        list.push({
          type: "route",
          path: layer.route.path,
          methods: Object.keys(layer.route.methods || {}),
        });
      } else if (
        layer.name === "router" &&
        layer.handle &&
        layer.handle.stack
      ) {
        // Print a short list of child route paths
        const childPaths = (layer.handle.stack || [])
          .map((child: any) => child.route?.path || child.path)
          .filter(Boolean);
        list.push({
          type: "router",
          prefix: layer.regexp?.source,
          children: childPaths.slice(0, 10),
        });
      } else {
        list.push({ type: layer.name || "unknown" });
      }
    });
    console.log(
      "🔎 App routes snapshot on startup:",
      JSON.stringify(list, null, 2)
    );
  } catch (err) {
    console.error("Failed to list app routes during startup:", err);
  }

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
