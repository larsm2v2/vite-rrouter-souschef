import session from "express-session";
import pgSession from "connect-pg-simple";
import pool from "../database";
import { Pool } from "pg";

const PgSession = pgSession(session);

// Create a separate test pool if in test mode
const sessionPool =
  process.env.NODE_ENV === "test"
    ? new Pool({
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: parseInt(process.env.PG_PORT || "5432"),
      })
    : pool;

// Use memory store for tests to avoid database session issues
const MemoryStore = session.MemoryStore;

export const sessionConfig: session.SessionOptions = {
  store:
    process.env.NODE_ENV === "test"
      ? new MemoryStore() // Use in-memory store for tests
      : new PgSession({
          pool: sessionPool,
          tableName: "user_sessions",
          createTableIfMissing: true,
          pruneSessionInterval: false,
        }),
  secret: process.env.SESSION_SECRET || "test-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  name: "sessionId", // Custom session cookie name
  // Add test-specific configuration
  ...(process.env.NODE_ENV === "test" && {
    cookie: {
      secure: false,
      sameSite: "lax",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
    resave: true, // Force save session for tests
    saveUninitialized: true, // Save even uninitialized sessions in tests
  }),
};
