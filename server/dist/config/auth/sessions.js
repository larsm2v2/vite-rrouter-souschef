"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionConfig = void 0;
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const database_1 = __importDefault(require("../database"));
const pg_1 = require("pg");
const PgSession = (0, connect_pg_simple_1.default)(express_session_1.default);
// Create a separate test pool if in test mode
const sessionPool = process.env.NODE_ENV === "test"
    ? new pg_1.Pool({
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: parseInt(process.env.PG_PORT || "5432"),
    })
    : database_1.default;
// Use memory store for tests to avoid database session issues
const MemoryStore = express_session_1.default.MemoryStore;
exports.sessionConfig = Object.assign({ store: process.env.NODE_ENV === "test"
        ? new MemoryStore() // Use in-memory store for tests
        : new PgSession({
            pool: sessionPool,
            tableName: "user_sessions",
            createTableIfMissing: true,
            pruneSessionInterval: false,
        }), secret: process.env.SESSION_SECRET || "test-secret", resave: false, saveUninitialized: false, cookie: {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }, name: "sessionId" }, (process.env.NODE_ENV === "test" && {
    cookie: {
        secure: false,
        sameSite: "lax",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
    },
    resave: true, // Force save session for tests
    saveUninitialized: true, // Save even uninitialized sessions in tests
}));
