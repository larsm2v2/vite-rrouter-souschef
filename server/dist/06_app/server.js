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
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const index_1 = require("../05_frameworks/index");
const database_1 = require("./database");
// Track application readiness state
let isReady = false;
let dbConnectionError = null;
// Health endpoint - always returns 200 if server is running (for Cloud Run health checks)
index_1.app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
// Readiness endpoint - returns 200 only when DB is connected and ready
index_1.app.get("/ready", (req, res) => {
    if (isReady) {
        res.status(200).json({
            status: "ready",
            database: "connected",
            timestamp: new Date().toISOString(),
        });
    }
    else {
        res.status(503).json({
            status: "not ready",
            database: "initializing",
            error: dbConnectionError === null || dbConnectionError === void 0 ? void 0 : dbConnectionError.message,
            timestamp: new Date().toISOString(),
        });
    }
});
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        // Start listening immediately so the container becomes healthy for Cloud Run
        // even if database initialization takes time or briefly fails.
        const PORT = process.env.PORT || 8000;
        const server = index_1.app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`Health check available at http://localhost:${PORT}/health`);
            console.log(`Readiness check available at http://localhost:${PORT}/ready`);
        });
        // Initialize database in the background with retry logic
        const initDB = (...args_1) => __awaiter(this, [...args_1], void 0, function* (retries = 5, delayMs = 2000) {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    yield (0, database_1.ensureDatabaseInitialized)();
                    isReady = true;
                    dbConnectionError = null;
                    console.log(`✅ Database connected and ready (attempt ${attempt})`);
                    return;
                }
                catch (err) {
                    dbConnectionError = err;
                    console.error(`❌ Database initialization failed (attempt ${attempt}/${retries}):`, err);
                    if (attempt < retries) {
                        const delay = delayMs * Math.pow(2, attempt - 1); // exponential backoff
                        console.log(`Retrying in ${delay}ms...`);
                        yield new Promise((resolve) => setTimeout(resolve, delay));
                    }
                }
            }
            console.error("⚠️ Database failed to initialize after all retries. Server will continue running but /ready will return 503.");
        });
        // Start DB initialization in background - don't block server startup
        initDB().catch((err) => {
            console.error("Database initialization process failed:", err);
        });
        // Graceful shutdown
        const shutdown = (signal) => {
            console.log(`Received ${signal}, shutting down gracefully...`);
            isReady = false; // Mark as not ready immediately
            server.close((err) => {
                if (err) {
                    console.error("Error during server shutdown:", err);
                    process.exit(1);
                }
                console.log("Server closed successfully");
                process.exit(0);
            });
        };
        process.on("SIGINT", () => shutdown("SIGINT"));
        process.on("SIGTERM", () => shutdown("SIGTERM"));
        return server;
    });
}
