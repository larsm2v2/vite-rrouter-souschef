"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionConfig = void 0;
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const pg_1 = require("pg");
const PgSession = (0, connect_pg_simple_1.default)(express_session_1.default);
// Use an in-memory store for tests. For non-test environments create a dedicated
// PG Pool for session storage (so the session store receives a real pg.Pool).
const sessionPool = process.env.NODE_ENV === "test"
    ? null
    : new pg_1.Pool({
        user: process.env.PG_USER || "postgres",
        host: process.env.PG_HOST || "localhost",
        database: process.env.PG_DATABASE || "SousChefDB",
        password: process.env.PG_PASSWORD || "tryhavok",
        port: parseInt(process.env.PG_PORT || "5432"),
    });
const MemoryStore = express_session_1.default.MemoryStore;
exports.sessionConfig = Object.assign({ store: process.env.NODE_ENV === "test"
        ? new MemoryStore()
        : new PgSession({
            pool: sessionPool,
            tableName: "user_sessions",
            createTableIfMissing: true,
        }), secret: process.env.SESSION_SECRET || "test-secret", resave: false, saveUninitialized: false, cookie: {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
    }, name: "sessionId" }, (process.env.NODE_ENV === "test" && {
    cookie: {
        secure: false,
        sameSite: "lax",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
    },
    resave: true,
    saveUninitialized: true,
}));
