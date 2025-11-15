"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
// src/05_frameworks/database/connection.ts
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pg_1 = require("pg");
const net_1 = __importDefault(require("net"));
const tls_1 = __importDefault(require("tls"));
const url_1 = require("url");
// Note: Express.User type is defined centrally in src/types/express.d.ts
function ensureDatabaseExists() {
    return __awaiter(this, void 0, void 0, function* () {
        // Skip database creation for cloud databases (Neon, etc.) - they're already created
        if (process.env.PG_URL) {
            console.log("Using cloud database (PG_URL), skipping database creation check");
            return;
        }
        const dbName = process.env.PG_DATABASE || "SousChefDB";
        const adminPool = new pg_1.Pool({
            user: process.env.PG_USER || "postgres",
            host: process.env.PG_HOST || "localhost",
            database: "postgres",
            password: process.env.PG_PASSWORD || "tryhavok",
            port: parseInt(process.env.PG_PORT || "5432"),
            ssl: process.env.NODE_ENV === "production"
                ? { rejectUnauthorized: false }
                : false,
        });
        try {
            const checkResult = yield adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
            if (checkResult.rowCount === 0) {
                console.log(`Database ${dbName} does not exist. Creating...`);
                const validDbName = /^[a-zA-Z0-9_]+$/.test(dbName);
                if (!validDbName) {
                    throw new Error(`Invalid database name: ${dbName}`);
                }
                yield adminPool.query(`CREATE DATABASE "${dbName}"`);
                console.log(`✅ Database ${dbName} created successfully`);
            }
            else {
                console.log(`Database ${dbName} already exists`);
            }
        }
        catch (err) {
            console.error("❌ Error ensuring database exists:", err);
            throw err;
        }
        finally {
            yield adminPool.end();
        }
    });
}
const isTestEnv = process.env.NODE_ENV === "test";
function createPool() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isTestEnv) {
            try {
                yield ensureDatabaseExists();
            }
            catch (err) {
                console.error("Failed to ensure database exists (continuing anyway):", err);
                // Don't exit - allow app to start and retry DB operations later
            }
        }
        const pgConfig = isTestEnv
            ? {
                user: process.env.PG_USER || "postgres",
                host: process.env.PG_HOST_TEST || "localhost",
                database: process.env.PG_DATABASE_TEST || "ttlo_test",
                password: process.env.PG_PASSWORD || "tryhavok",
                port: parseInt(process.env.PG_PORT || "5432"),
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            }
            : process.env.PG_URL
                ? {
                    connectionString: process.env.PG_URL,
                    ssl: { rejectUnauthorized: false },
                    max: 10,
                    idleTimeoutMillis: 30000,
                    // Increase connection timeout to give remote cloud DBs more time to respond
                    connectionTimeoutMillis: 10000,
                }
                : {
                    user: process.env.PG_USER || "postgres",
                    host: process.env.PG_HOST || "localhost",
                    database: process.env.PG_DATABASE || "SousChefDB",
                    password: process.env.PG_PASSWORD || "tryhavok",
                    port: parseInt(process.env.PG_PORT || "5432"),
                    max: 10,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 2000,
                    ssl: process.env.NODE_ENV === "production"
                        ? { rejectUnauthorized: false }
                        : false,
                };
        const pool = new pg_1.Pool(pgConfig);
        // Diagnostic: attach pool error handler to capture unexpected errors
        pool.on("error", (err) => {
            try {
                console.error("PG POOL ERROR:", {
                    message: err === null || err === void 0 ? void 0 : err.message,
                    code: err === null || err === void 0 ? void 0 : err.code,
                    stack: err === null || err === void 0 ? void 0 : err.stack,
                });
            }
            catch (e) {
                console.error("PG POOL ERROR (unable to serialize):", err);
            }
        });
        // Diagnostic probes: TCP and TLS checks for connection host (only for PG_URL)
        function runConnectionProbes() {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const connString = process.env.PG_URL;
                    if (!connString)
                        return;
                    let parsed;
                    try {
                        parsed = new url_1.URL(connString);
                    }
                    catch (e) {
                        console.warn("Cannot parse PG_URL for probes", e);
                        return;
                    }
                    const host = parsed.hostname;
                    const port = parseInt(parsed.port || "5432");
                    const tcpResult = yield tcpProbe(host, port, 5000);
                    console.log("DB TCP probe result:", tcpResult);
                    const tlsResult = yield tlsProbe(host, port, 7000, parsed.hostname);
                    console.log("DB TLS probe result:", tlsResult);
                }
                catch (err) {
                    console.error("DB probe failed:", err);
                }
            });
        }
        function tcpProbe(host, port, timeoutMs) {
            return new Promise((resolve) => {
                const start = Date.now();
                const socket = net_1.default.connect(port, host);
                let done = false;
                const finish = (status, info) => {
                    if (done)
                        return;
                    done = true;
                    try {
                        socket.destroy();
                    }
                    catch (e) { }
                    resolve({ status, durationMs: Date.now() - start, info });
                };
                socket.setTimeout(timeoutMs, () => finish("timeout"));
                socket.on("connect", () => finish("connected"));
                socket.on("error", (err) => finish("error", { message: err.message, code: err.code }));
            });
        }
        function tlsProbe(host, port, timeoutMs, servername) {
            return new Promise((resolve) => {
                const start = Date.now();
                const opts = { host, port };
                if (servername)
                    opts.servername = servername;
                const socket = tls_1.default.connect(opts, () => {
                    const cert = socket.getPeerCertificate && socket.getPeerCertificate();
                    resolve({
                        status: "secure_connected",
                        durationMs: Date.now() - start,
                        cert: cert && cert.subject,
                    });
                    socket.end();
                });
                let done = false;
                const finish = (status, info) => {
                    if (done)
                        return;
                    done = true;
                    try {
                        socket.destroy();
                    }
                    catch (e) { }
                    resolve({ status, durationMs: Date.now() - start, info });
                };
                socket.setTimeout(timeoutMs, () => finish("timeout"));
                socket.on("error", (err) => finish("error", { message: err.message, code: err.code }));
            });
        }
        // Run probes asynchronously, don't block pool creation
        runConnectionProbes().catch((err) => console.error("runConnectionProbes error:", err));
        // Don't test connection during pool creation to avoid blocking startup.
        // Connection will be tested on first query. This allows the HTTP server
        // to start and become healthy even if DB is temporarily unavailable.
        if (!isTestEnv) {
            console.log("✅ PostgreSQL pool created (connection will be tested on first query)");
        }
        return pool;
    });
}
const poolPromise = createPool();
let internalPool;
const poolWrapper = {
    query: (text, params) => __awaiter(void 0, void 0, void 0, function* () {
        if (!internalPool) {
            internalPool = yield poolPromise;
        }
        return internalPool.query(text, params);
    }),
    connect: () => __awaiter(void 0, void 0, void 0, function* () {
        if (!internalPool) {
            internalPool = yield poolPromise;
        }
        return internalPool.connect();
    }),
    end: () => __awaiter(void 0, void 0, void 0, function* () {
        if (internalPool) {
            console.log("Closing database pool connections...");
            const result = yield internalPool.end();
            internalPool = null;
            console.log("Database pool connections closed");
            return result;
        }
        return null;
    }),
};
exports.default = poolWrapper;
// Backwards-compatible named export used elsewhere in the codebase
exports.pool = poolWrapper;
