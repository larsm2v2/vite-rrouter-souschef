import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
// Import the directory index explicitly to avoid importing the legacy
// `routes.ts` file. This ensures the new combined router in
// `./routes/index.ts` (which mounts /api/oauth etc.) is used in production.
import routes from "./routes/index";
// API Gateway Layer - Phase 1A
import { createGatewayMiddleware, errorLoggingMiddleware } from "./gateway";
// Passport is no longer used - replaced with openid-client for PKCE support
// import passport from "passport";
// import { configurePassport } from "../auth/passport";

console.log("📋 Loading routes...");
// Diagnostic: flag app creation so we can detect multiple app instances
if ((global as any).__souschef_app_created__) {
  console.warn(
    "⚠️ Express app instance already created elsewhere in the process — multiple apps may be running"
  );
} else {
  (global as any).__souschef_app_created__ = true;
}
console.log("✅ Routes module imported:", typeof routes);
console.log("   Routes is Router?", routes && typeof routes === "function");
console.log("   Routes stack length:", routes?.stack?.length || 0);

const app = express();

// Passport configuration removed - now using openid-client with PKCE
// configurePassport();

app.set("trust proxy", 1);
app.use(helmet());

// API Gateway Layer - centralizes CORS, logging, rate limiting
app.use(createGatewayMiddleware());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Passport removed - using openid-client with PKCE instead
// app.use(passport.initialize());
// Sessions disabled - using JWT tokens instead
// app.use(session(sessionConfig));
// app.use(passport.session());
app.use(routes);
console.log(
  "✅ Routes mounted. App stack layers:",
  app._router?.stack?.length || 0
);

// Print a compact summary of layers and mounted route paths for quick diagnostics
try {
  const entries =
    app._router?.stack?.map((layer: any, i: number) => {
      const isRouter = layer.name === "router";
      const prefix =
        isRouter && layer.regexp
          ? layer.regexp?.source
          : layer.route?.path || "";
      return {
        i,
        name: layer.name,
        path: prefix,
        hasStack: !!layer.handle?.stack,
      };
    }) || [];
  console.log("🔍 App router layer summary:", JSON.stringify(entries, null, 2));
} catch (e) {
  console.error("Failed to summarize app router stack:", e);
}

// Error logging middleware (must be after routes)
app.use(errorLoggingMiddleware);

export default app;
