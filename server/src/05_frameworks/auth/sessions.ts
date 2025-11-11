import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool } from "pg";

const PgSession = pgSession(session);

// Use an in-memory store for tests. For non-test environments create a dedicated
// PG Pool for session storage (so the session store receives a real pg.Pool).
const sessionPool: Pool | null =
  process.env.NODE_ENV === "test"
    ? null
    : new Pool({
        user: process.env.PG_USER || "postgres",
        host: process.env.PG_HOST || "localhost",
        database: process.env.PG_DATABASE || "SousChefDB",
        password: process.env.PG_PASSWORD || "tryhavok",
        port: parseInt(process.env.PG_PORT || "5432"),
      });

const MemoryStore = session.MemoryStore;

export const sessionConfig: session.SessionOptions = {
  store:
    process.env.NODE_ENV === "test"
      ? new MemoryStore()
      : new PgSession({
          pool: sessionPool as Pool,
          tableName: "user_sessions",
          createTableIfMissing: true,
        }),
  secret: process.env.SESSION_SECRET || "test-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
  name: "sessionId",
  ...(process.env.NODE_ENV === "test" && {
    cookie: {
      secure: false,
      sameSite: "lax",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
    resave: true,
    saveUninitialized: true,
  }),
};
