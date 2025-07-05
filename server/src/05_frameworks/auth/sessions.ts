import session from "express-session";
import pgSession from "connect-pg-simple";
import { pool } from "../database/connection";

const PgSession = pgSession(session);

export const sessionConfig = {
  store: new PgSession({
    pool,
    tableName: "user_sessions",
  }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 3600000, // 1 hour
  },
};
