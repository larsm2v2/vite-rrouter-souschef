import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import passport, { configurePassport } from "./config/auth/passport"; // Ensure this is correctly configured
import { sessionConfig } from "./config/auth/sessions";
import * as crypto from "crypto";
import type { User } from "./types/entities/User"; // Import the User interface
import pool from "./config/database";
import { initializeDatabase } from "./config/schema";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes";
import rateLimit from "express-rate-limit";
import { param } from "express-validator";
import profileRoutes from "./routes/profile";
import recipeRoutes from "./routes/recipes.routes";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    credentials: true, // Required for cookies/sessions
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

app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// Add request logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.log("Headers:", req.headers);
  next();
});

// Mount auth routes
app.use("/auth", authRoutes);

// Mount recipe routes
app.use("/recipes", recipeRoutes);

// Mount profile routes
app.use("/profile", profileRoutes);

// Google OAuth Configuration
const GOOGLE_OAUTH_URL = process.env.GOOGLE_OAUTH_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
//Audit Log
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Hook into response finish to log the outcome
  res.on("finish", async () => {
    try {
      // Skip audit logging for test routes
      if (process.env.NODE_ENV === "test" && req.path.startsWith("/test/")) {
        return;
      }

      await pool.query(
        `INSERT INTO audit_log (
          user_id, action, endpoint, ip_address, 
          user_agent, status_code, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          req.user?.id || null,
          req.method,
          req.originalUrl,
          req.ip,
          req.headers["user-agent"],
          res.statusCode,
          JSON.stringify({
            params: req.params,
            query: req.query,
            durationMs: Date.now() - startTime,
          }),
        ]
      );
    } catch (err) {
      // Only log errors in non-test environment
      if (process.env.NODE_ENV !== "test") {
        console.error(
          "Audit log failed:",
          err instanceof Error ? err.message : String(err)
        );
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
  // For tests, add debug logging
  if (process.env.NODE_ENV === "test") {
    console.log("Profile request:", {
      hasUser: !!req.user,
      user: req.user,
      sessionID: req.sessionID,
      hasSession: !!req.session,
    });
  }

  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Get user profile
    const userResult = await pool.query(
      `SELECT id, email, display_name, avatar 
       FROM users WHERE id = $1`,
      [req.user.id]
    );
  } catch (err) {
    // Only log errors in non-test environment
    if (process.env.NODE_ENV !== "test") {
      console.error(
        "User Profile Retrieval failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
});

app.get("/auth/check", (req, res) => {
  // res.json({ authenticated: !!req.user });
  if (!req.user) {
    return res.status(200).json({ authenticated: false });
  }

  // Return minimal user data for frontend
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      display_name: req.user.display_name,
    },
  });
});

app.get("/user", (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
  }
  res.json(req.user);
});

// Stats endpoint with validation
app.get(
  "/stats/:userId",
  param("userId").isInt().toInt(),
  async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    try {
      const stats = await pool.query(
        `SELECT 
          current_level AS "current_level",
          least_moves AS "leastMoves", 
          custom_levels AS "customLevels"
         FROM game_stats 
         WHERE user_id = $1`,
        [req.params.userId]
      );

      res.json(
        stats.rows[0] || {
          current_level: 1,
          leastMoves: [],
          customLevels: [],
        }
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    }
  }
);
// Logout Route
app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

app.get("/sample-stats", (req, res) => {
  if (!req.user) res.status(401).json({ error: "Unauthorized" });

  res.json({
    current_level: 5,
    leastMoves: 18,
  });
});

// Enhanced logout
app.post("/auth/logout", (req: Request, res: Response) => {
  req.logout(() => {
    req.session?.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });
});

app.post("/game/progress", async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { level, moves, completed } = req.body;

    // Validate input
    if (!level || typeof level !== "number") {
      return res.status(400).json({ error: "Invalid level" });
    }

    // First, get the current level
    const userStatsResult = await pool.query(
      `SELECT current_level, best_combination 
       FROM game_stats WHERE user_id = $1`,
      [req.user.id]
    );

    const userStats = userStatsResult.rows[0];
    const currentLevel = userStats?.current_level || 1;

    // Only update level if the completed level is the current one
    // and we're moving to the next level
    let newLevel = currentLevel;
    if (completed && level === currentLevel) {
      newLevel = currentLevel + 1;
    }

    // Store the moves as best combination if better than current
    // or if no best combination exists for this level
    let bestCombination = userStats?.best_combination || [];
    if (Array.isArray(bestCombination)) {
      // If this level doesn't have a best combination yet or new moves is better
      if (!bestCombination[level - 1] || moves < bestCombination[level - 1]) {
        // Create a copy of the array with the right length
        const newBestCombination = [...bestCombination];
        // Make sure the array is long enough
        while (newBestCombination.length < level) {
          newBestCombination.push(null);
        }
        // Set the new best for this level
        newBestCombination[level - 1] = moves;
        bestCombination = newBestCombination;
      }
    }

    // Update the database
    await pool.query(
      `UPDATE game_stats
       SET current_level = $1, best_combination = $2
       WHERE user_id = $3`,
      [newLevel, JSON.stringify(bestCombination), req.user.id]
    );

    res.json({
      success: true,
      current_level: newLevel,
      best_combination: bestCombination,
    });
  } catch (err) {
    console.error("Game progress update error:", err);
    res.status(500).json({ error: "Database error" });
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
  try {
    // Try to query the users table
    await pool.query("SELECT 1 FROM users LIMIT 1");
    console.log("✅ Database already initialized.");
  } catch (error) {
    console.warn(
      "⚠️ Database not initialized. Running initializeDatabase()..."
    );
    await initializeDatabase();
  }
}

// Start the server
async function startServer() {
  await ensureDatabaseInitialized();
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
if (process.env.NODE_ENV !== "test") {
  startServer(); // Only start server when not testing
}

export default app;
