import "reflect-metadata"; // required by tsyringe
import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import session from "express-session"; // kept for test environment only
import passport, { configurePassport } from "./05_frameworks/auth/passport"; // Ensure this is correctly configured
import { sessionConfig } from "./05_frameworks/auth/sessions";
import * as crypto from "crypto";
import type { User } from "./01_entities"; // Import the User interface from canonical entities
import pool from "./05_frameworks/database/connection";
import { initializeDatabase } from "./05_frameworks/database/schema";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import frameworkRoutes from "./05_frameworks/myexpress/routes";
import { param } from "express-validator";
import profileRoutes from "./routes/profile";
import recipeRoutes from "./routes/recipes.routes";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  LogAudit,
  CheckAuthentication,
  GetUserProfile,
  LogoutUser,
} from "./02_use_cases";
import { UserRepository } from "./03_adapters/repositories";
import { container } from "tsyringe";
import "./04_factories/di"; // initialize DI container and reflect-metadata

const app = express();
app.set("trust proxy", 1);
const requiredEnvVars = [
  "SESSION_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
  "CLIENT_URL",
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    throw new Error(`${varName} is not defined in .env`);
  }
});

// In app.ts (near other env config)
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.warn(
    "API_KEY environment variable not found! AI features will be disabled."
  );
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
// Configure Passport
configurePassport();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        process.env.CLIENT_URL,
        "http://localhost:5173",
        "http://localhost:5174",
      ];

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log(`Origin ${origin} not allowed by CORS`);
        callback(null, false);
      }
    },
    // Only enable credentials (cookies/sessions) during test runs to preserve legacy test flows.
    credentials: process.env.NODE_ENV === "test",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    exposedHeaders: ["Content-Type", "Authorization", "X-RateLimit-Reset"],
  })
);
app.options("*", cors());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/auth/check",
  })
);
app.use(express.json());
// Add URL-encoded middleware to handle form data
app.use(express.urlencoded({ extended: true }));

// Initialize passport. Only mount session middleware in test environment to keep
// the legacy test helpers (mock-login) working. Production and newDev should use `src/06_app`.
app.use(passport.initialize());
if (process.env.NODE_ENV === "test") {
  app.use(session(sessionConfig));
  app.use(passport.session());
}

// Add request logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.log("Headers:", req.headers);
  next();
});

// Mount consolidated framework routes
app.use(frameworkRoutes);

// Google OAuth Configuration
const GOOGLE_OAUTH_URL = process.env.GOOGLE_OAUTH_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
// Audit Log (resolve from DI)
const logAudit = container.resolve(LogAudit);

app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on("finish", async () => {
    try {
      if (process.env.NODE_ENV === "test" && req.path.startsWith("/test/")) {
        return;
      }

      await logAudit.execute({
        userId: req.user?.id,
        action: req.method,
        endpoint: req.originalUrl,
        ipAddress: req.ip ?? "",
        userAgent: req.headers["user-agent"],
        statusCode: res.statusCode,
        metadata: {
          params: req.params,
          query: req.query,
          durationMs: Date.now() - startTime,
        },
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "test") {
        console.error("Audit log failed:", err);
      }
    }
  });

  next();
});
app.get("/", (req: Request, res: Response) => {
  res.redirect(process.env.CLIENT_URL + "/login");
});

// Protected routes
app.get("/profile", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const getUserProfile = container.resolve(GetUserProfile);
    const userProfile = await getUserProfile.execute(req.user.id);

    if (!userProfile) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(userProfile);
  } catch (err) {
    console.error("Error retrieving profile:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/auth/check", async (req, res) => {
  const checkAuthentication = container.resolve(CheckAuthentication);
  const authStatus = await checkAuthentication.execute(req.user);
  res.json(authStatus);
});

app.get("/user", (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
  }
  res.json(req.user);
});

// Logout Route
app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

// Enhanced logout
app.post("/auth/logout", async (req, res) => {
  const logoutUser = container.resolve(LogoutUser) as LogoutUser;

  try {
    await logoutUser.execute(req);
    res.clearCookie("connect.sid");
    res.json({ success: true });
  } catch (err) {
    console.error("Error during logout:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log the error with stack trace
  console.error("Server error:", err);
  console.error("Error stack:", err.stack);

  // For OAuth errors, add more detailed logging
  if (req.path.includes("/auth/google") || req.path.includes("/callback")) {
    console.error("OAuth error details:", {
      path: req.path,
      method: req.method,
      query: req.query,
      session: req.session ? "Session exists" : "No session",
      user: req.user ? "User exists" : "No user",
    });
  }

  // Don't expose error details in production
  if (process.env.NODE_ENV === "production") {
    return res.status(500).json({ error: "Internal Server Error" });
  } else {
    // In development, return the error details
    return res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
      stack: err.stack,
    });
  }
});

// Initialize database for tests
if (process.env.NODE_ENV === "test") {
  (async () => {
    try {
      await initializeDatabase();
      console.log("✅ Test database initialized");
    } catch (err) {
      console.error("❌ Test database initialization failed:", err);
    }
  })();
}

// Test routes - only available in test environment
if (process.env.NODE_ENV === "test") {
  app.post(
    "/test/mock-login",
    (req: Request, res: Response, next: NextFunction) => {
      console.log("Mock login request:", {
        userId: req.body.userId,
        sessionID: req.sessionID,
      });

      // Create test user object
      const testUser = {
        id: req.body.userId,
        email: "test@example.com",
        display_name: "Test User",
      };

      // Login with the test user
      req.login(testUser, { session: true }, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ error: err.message });
        }

        // Save the session
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ error: err.message });
          }

          console.log("Login successful:", {
            user: req.user,
            sessionID: req.sessionID,
            sessionCookie: req.sessionID && res.getHeader("set-cookie"),
          });

          // Return success with the cookie
          return res.status(200).json({ success: true });
        });
      });
    }
  );
}

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Increased limit
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Explicitly return boolean (never undefined)
    return (
      req.path === "/auth/check" &&
      req.method === "GET" &&
      !!req.get("Referer")?.includes("/login")
    );
  },
});
app.use(authRateLimiter);

async function ensureDatabaseInitialized() {
  const maxAttempts = 5;
  let attempt = 0;
  const baseDelayMs = 2000;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      // Try to query the users table
      await pool.query("SELECT 1 FROM users LIMIT 1");
      console.log("✅ Database already initialized.");
      return;
    } catch (error) {
      console.warn(
        `⚠️ Database check attempt ${attempt} failed: ${
          (error as any)?.message || error
        }`
      );
      if (attempt >= maxAttempts) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`Waiting ${delay}ms before retrying database check...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.warn(
    "⚠️ Database not reachable after multiple attempts. Scheduling initialization in background and continuing to start server."
  );

  // Try to run initialization in background without blocking server startup
  initializeDatabase()
    .then(() => console.log("✅ Background database initialization completed"))
    .catch((err) =>
      console.error("❌ Background database initialization failed:", err)
    );
}

// Start the server
async function startServer() {
  // Start DB init in background so server can accept requests even if DB is temporarily unreachable
  ensureDatabaseInitialized().catch((err) =>
    console.error("ensureDatabaseInitialized failed (background):", err)
  );

  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
if (process.env.NODE_ENV !== "test") {
  startServer(); // Only start server when not testing
}

export default app;
