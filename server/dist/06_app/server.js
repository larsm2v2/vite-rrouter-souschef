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
// Debug endpoint - shows registered routes
index_1.app.get("/debug/routes", (req, res) => {
    var _a, _b, _c;
    // Walk the middleware stack recursively and collect routes. This is more
    // robust than the previous implementation which missed nested routers in
    // some edge cases across environments.
    const routes = [];
    function walk(stack, basePath = "") {
        stack.forEach((layer) => {
            try {
                if (layer.route) {
                    // Direct route on app or router
                    routes.push({
                        path: basePath + (layer.route.path || ""),
                        methods: Object.keys(layer.route.methods || {}),
                    });
                }
                else if (layer.name === "router" &&
                    layer.handle &&
                    layer.handle.stack) {
                    // Router middleware: compute its prefix and dive into children
                    const prefix = layer.regexp && layer.regexp.source
                        ? layer.regexp.source
                            .replace("\\/?", "")
                            .replace("(?=\\/|$)", "")
                            .replace(/\\/g, "")
                        : "";
                    // If the prefix looks like ^\/api\/oauth\/?(?=\/|$) this will
                    // convert it to /api/oauth
                    const cleaned = prefix.replace(/\^|\$|\(|\)|\?=|\\/g, "");
                    const newBase = (basePath + cleaned).replace(/\/\//g, "/");
                    // Recurse into this router
                    walk(layer.handle.stack, newBase);
                }
            }
            catch (ignore) {
                // Defensive - don't fail debug route because one middleware is odd
            }
        });
    }
    walk(((_a = index_1.app._router) === null || _a === void 0 ? void 0 : _a.stack) || []);
    res.json({
        totalMiddleware: ((_c = (_b = index_1.app._router) === null || _b === void 0 ? void 0 : _b.stack) === null || _c === void 0 ? void 0 : _c.length) || 0,
        routes: routes,
    });
});
// Debug: list all loaded modules that look like routes to detect tree-shaking
index_1.app.get("/debug/imported-modules", (req, res) => {
    try {
        const modules = Object.keys(require.cache || {}).filter((k) => k.includes("/routes/") || k.includes("\\routes\\"));
        res.json({ count: modules.length, modules: modules.slice(0, 200) });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // Start listening immediately so the container becomes healthy for Cloud Run
        // even if database initialization takes time or briefly fails.
        const PORT = process.env.PORT || 8000;
        const server = index_1.app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`Health check available at http://localhost:${PORT}/health`);
            console.log(`Readiness check available at http://localhost:${PORT}/ready`);
        });
        // Diagnostic: print the full app router paths on startup for Cloud Run logs
        try {
            const list = [];
            (((_a = index_1.app._router) === null || _a === void 0 ? void 0 : _a.stack) || []).forEach((layer) => {
                var _a;
                if (layer.route) {
                    list.push({
                        type: "route",
                        path: layer.route.path,
                        methods: Object.keys(layer.route.methods || {}),
                    });
                }
                else if (layer.name === "router" &&
                    layer.handle &&
                    layer.handle.stack) {
                    // Print a short list of child route paths
                    const childPaths = (layer.handle.stack || [])
                        .map((child) => { var _a; return ((_a = child.route) === null || _a === void 0 ? void 0 : _a.path) || child.path; })
                        .filter(Boolean);
                    list.push({
                        type: "router",
                        prefix: (_a = layer.regexp) === null || _a === void 0 ? void 0 : _a.source,
                        children: childPaths.slice(0, 10),
                    });
                }
                else {
                    list.push({ type: layer.name || "unknown" });
                }
            });
            console.log("🔎 App routes snapshot on startup:", JSON.stringify(list, null, 2));
        }
        catch (err) {
            console.error("Failed to list app routes during startup:", err);
        }
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
