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
// Note: Express.User type is defined centrally in src/types/express.d.ts
function ensureDatabaseExists() {
    return __awaiter(this, void 0, void 0, function* () {
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
                console.error("Failed to ensure database exists:", err);
                process.exit(1);
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
                    connectionTimeoutMillis: 2000,
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
        if (!isTestEnv) {
            try {
                const res = yield pool.query("SELECT NOW() as now");
                console.log("✅ PostgreSQL connected at", res.rows[0].now);
            }
            catch (err) {
                console.error("❌ PostgreSQL connection error:", err);
                process.exit(1);
            }
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
