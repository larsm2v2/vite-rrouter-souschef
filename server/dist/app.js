"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
require("reflect-metadata"); // required by tsyringe
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session")); // kept for test environment only
const passport_1 = __importStar(require("./05_frameworks/auth/passport")); // Ensure this is correctly configured
const sessions_1 = require("./05_frameworks/auth/sessions");
const connection_1 = __importDefault(require("./05_frameworks/database/connection"));
const schema_1 = require("./05_frameworks/database/schema");
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const routes_1 = __importDefault(require("./05_frameworks/myexpress/routes"));
const generative_ai_1 = require("@google/generative-ai");
const _02_use_cases_1 = require("./02_use_cases");
const tsyringe_1 = require("tsyringe");
require("./04_factories/di"); // initialize DI container and reflect-metadata
const app = (0, express_1.default)();
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
    console.warn("API_KEY environment variable not found! AI features will be disabled.");
}
const genAI = apiKey ? new generative_ai_1.GoogleGenerativeAI(apiKey) : null;
// Configure Passport
(0, passport_1.configurePassport)();
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl)
        if (!origin)
            return callback(null, true);
        const allowedOrigins = [
            process.env.CLIENT_URL,
            "http://localhost:5173",
            "http://localhost:5174",
        ];
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            console.log(`Origin ${origin} not allowed by CORS`);
            callback(null, false);
        }
    },
    // Only enable credentials (cookies/sessions) during test runs to preserve legacy test flows.
    credentials: process.env.NODE_ENV === "test",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    exposedHeaders: ["Content-Type", "Authorization", "X-RateLimit-Reset"],
}));
app.options("*", (0, cors_1.default)());
app.use((0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/auth/check",
}));
app.use(express_1.default.json());
// Add URL-encoded middleware to handle form data
app.use(express_1.default.urlencoded({ extended: true }));
// Initialize passport. Only mount session middleware in test environment to keep
// the legacy test helpers (mock-login) working. Production and newDev should use `src/06_app`.
app.use(passport_1.default.initialize());
if (process.env.NODE_ENV === "test") {
    app.use((0, express_session_1.default)(sessions_1.sessionConfig));
    app.use(passport_1.default.session());
}
// Add request logger middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    console.log("Headers:", req.headers);
    next();
});
// Mount consolidated framework routes
app.use(routes_1.default);
// Google OAuth Configuration
const GOOGLE_OAUTH_URL = process.env.GOOGLE_OAUTH_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const GOOGLE_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
];
// Audit Log (resolve from DI)
const logAudit = tsyringe_1.container.resolve(_02_use_cases_1.LogAudit);
app.use((req, res, next) => {
    const startTime = Date.now();
    res.on("finish", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        try {
            if (process.env.NODE_ENV === "test" && req.path.startsWith("/test/")) {
                return;
            }
            yield logAudit.execute({
                userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                action: req.method,
                endpoint: req.originalUrl,
                ipAddress: (_b = req.ip) !== null && _b !== void 0 ? _b : "",
                userAgent: req.headers["user-agent"],
                statusCode: res.statusCode,
                metadata: {
                    params: req.params,
                    query: req.query,
                    durationMs: Date.now() - startTime,
                },
            });
        }
        catch (err) {
            if (process.env.NODE_ENV !== "test") {
                console.error("Audit log failed:", err);
            }
        }
    }));
    next();
});
app.get("/", (req, res) => {
    res.redirect(process.env.CLIENT_URL + "/login");
});
// Protected routes
app.get("/profile", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const getUserProfile = tsyringe_1.container.resolve(_02_use_cases_1.GetUserProfile);
        const userProfile = yield getUserProfile.execute(req.user.id);
        if (!userProfile) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(userProfile);
    }
    catch (err) {
        console.error("Error retrieving profile:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
app.get("/auth/check", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const checkAuthentication = tsyringe_1.container.resolve(_02_use_cases_1.CheckAuthentication);
    const authStatus = yield checkAuthentication.execute(req.user);
    res.json(authStatus);
}));
app.get("/user", (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
    }
    res.json(req.user);
});
// Logout Route
app.get("/logout", (req, res) => {
    req.logout(() => {
        res.redirect("/");
    });
});
// Enhanced logout
app.post("/auth/logout", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const logoutUser = tsyringe_1.container.resolve(_02_use_cases_1.LogoutUser);
    try {
        yield logoutUser.execute(req);
        res.clearCookie("connect.sid");
        res.json({ success: true });
    }
    catch (err) {
        console.error("Error during logout:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
app.use((err, req, res, next) => {
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
    }
    else {
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
    (() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, schema_1.initializeDatabase)();
            console.log("✅ Test database initialized");
        }
        catch (err) {
            console.error("❌ Test database initialization failed:", err);
        }
    }))();
}
// Test routes - only available in test environment
if (process.env.NODE_ENV === "test") {
    app.post("/test/mock-login", (req, res, next) => {
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
    });
}
const authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60, // Increased limit
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        var _a;
        // Explicitly return boolean (never undefined)
        return (req.path === "/auth/check" &&
            req.method === "GET" &&
            !!((_a = req.get("Referer")) === null || _a === void 0 ? void 0 : _a.includes("/login")));
    },
});
app.use(authRateLimiter);
function ensureDatabaseInitialized() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Try to query the users table
            yield connection_1.default.query("SELECT 1 FROM users LIMIT 1");
            console.log("✅ Database already initialized.");
        }
        catch (error) {
            console.warn("⚠️ Database not initialized. Running initializeDatabase()...");
            yield (0, schema_1.initializeDatabase)();
        }
    });
}
// Start the server
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        yield ensureDatabaseInitialized();
        const PORT = process.env.PORT || 8000;
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    });
}
if (process.env.NODE_ENV !== "test") {
    startServer(); // Only start server when not testing
}
exports.default = app;
