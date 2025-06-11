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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importStar(require("./config/auth/passport")); // Ensure this is correctly configured
const sessions_1 = require("./config/auth/sessions");
const database_1 = __importDefault(require("./config/database"));
const schema_1 = require("./config/schema");
const helmet_1 = __importDefault(require("helmet"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_validator_1 = require("express-validator");
const profile_1 = __importDefault(require("./routes/profile"));
const recipes_routes_1 = __importDefault(require("./routes/recipes.routes"));
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
    credentials: true, // Required for cookies/sessions
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
app.use((0, express_session_1.default)(sessions_1.sessionConfig));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Add request logger middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    console.log("Headers:", req.headers);
    next();
});
// Mount auth routes
app.use("/auth", auth_routes_1.default);
// Mount recipe routes
app.use("/api/recipes", recipes_routes_1.default);
// Mount profile routes
app.use("/profile", profile_1.default);
// Google OAuth Configuration
const GOOGLE_OAUTH_URL = process.env.GOOGLE_OAUTH_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const GOOGLE_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
];
//Audit Log
app.use((req, res, next) => {
    const startTime = Date.now();
    // Hook into response finish to log the outcome
    res.on("finish", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            // Skip audit logging for test routes
            if (process.env.NODE_ENV === "test" && req.path.startsWith("/test/")) {
                return;
            }
            yield database_1.default.query(`INSERT INTO audit_log (
          user_id, action, endpoint, ip_address, 
          user_agent, status_code, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || null,
                req.method,
                req.originalUrl,
                req.ip,
                req.headers["user-agent"],
                res.statusCode,
                JSON.stringify({
                    params: req.params,
                    query: req.query,
                    durationMs: Date.now() - startTime,
                }),
            ]);
        }
        catch (err) {
            // Only log errors in non-test environment
            if (process.env.NODE_ENV !== "test") {
                console.error("Audit log failed:", err instanceof Error ? err.message : String(err));
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
    // For tests, add debug logging
    if (process.env.NODE_ENV === "test") {
        console.log("Profile request:", {
            hasUser: !!req.user,
            user: req.user,
            sessionID: req.sessionID,
            hasSession: !!req.session,
        });
    }
    if (!req.user)
        return res.status(401).json({ error: "Unauthorized" });
    try {
        // Get user profile
        const userResult = yield database_1.default.query(`SELECT id, email, display_name, avatar 
       FROM users WHERE id = $1`, [req.user.id]);
        // Get game stats
        const statsResult = yield database_1.default.query(`SELECT current_level, best_combination, saved_maps
       FROM game_stats WHERE user_id = $1`, [req.user.id]);
        // Base stats (ensure defaults)
        const baseStats = statsResult.rows[0] || {
            current_level: 1,
            best_combination: [],
            saved_maps: [],
        };
        // Fetch minimum moves for all classic levels
        const { rows: minMovesRows } = yield database_1.default.query(`SELECT level, min_moves FROM classic_puzzles WHERE difficulty = '' OR difficulty = 'classic'`);
        const minMovesMap = {};
        minMovesRows.forEach((row) => {
            minMovesMap[row.level] = row.min_moves;
        });
        res.json({
            user: userResult.rows[0],
            stats: Object.assign(Object.assign({}, baseStats), { min_moves: minMovesMap }),
        });
    }
    catch (err) {
        console.error("Profile error:", err);
        res.status(500).json({ error: "Database error" });
    }
}));
app.get("/auth/check", (req, res) => {
    // res.json({ authenticated: !!req.user });
    if (!req.user) {
        return res.status(200).json({ authenticated: false });
    }
    // Return minimal user data for frontend
    res.json({
        authenticated: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            display_name: req.user.display_name,
        },
    });
});
app.get("/user", (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
    }
    res.json(req.user);
});
// Stats endpoint with validation
app.get("/stats/:userId", (0, express_validator_1.param)("userId").isInt().toInt(), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ error: "Unauthorized" });
    try {
        const stats = yield database_1.default.query(`SELECT 
          current_level AS "current_level",
          least_moves AS "leastMoves", 
          custom_levels AS "customLevels"
         FROM game_stats 
         WHERE user_id = $1`, [req.params.userId]);
        res.json(stats.rows[0] || {
            current_level: 1,
            leastMoves: [],
            customLevels: [],
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
}));
// Logout Route
app.get("/logout", (req, res) => {
    req.logout(() => {
        res.redirect("/");
    });
});
app.get("/sample-stats", (req, res) => {
    if (!req.user)
        res.status(401).json({ error: "Unauthorized" });
    res.json({
        current_level: 5,
        leastMoves: 18,
    });
});
// Enhanced logout
app.post("/auth/logout", (req, res) => {
    req.logout(() => {
        var _a;
        (_a = req.session) === null || _a === void 0 ? void 0 : _a.destroy(() => {
            res.clearCookie("connect.sid");
            res.json({ success: true });
        });
    });
});
app.post("/game/progress", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ error: "Unauthorized" });
    try {
        const { level, moves, completed } = req.body;
        // Validate input
        if (!level || typeof level !== "number") {
            return res.status(400).json({ error: "Invalid level" });
        }
        // First, get the current level
        const userStatsResult = yield database_1.default.query(`SELECT current_level, best_combination 
       FROM game_stats WHERE user_id = $1`, [req.user.id]);
        const userStats = userStatsResult.rows[0];
        const currentLevel = (userStats === null || userStats === void 0 ? void 0 : userStats.current_level) || 1;
        // Only update level if the completed level is the current one
        // and we're moving to the next level
        let newLevel = currentLevel;
        if (completed && level === currentLevel) {
            newLevel = currentLevel + 1;
        }
        // Store the moves as best combination if better than current
        // or if no best combination exists for this level
        let bestCombination = (userStats === null || userStats === void 0 ? void 0 : userStats.best_combination) || [];
        if (Array.isArray(bestCombination)) {
            // If this level doesn't have a best combination yet or new moves is better
            if (!bestCombination[level - 1] || moves < bestCombination[level - 1]) {
                // Create a copy of the array with the right length
                const newBestCombination = [...bestCombination];
                // Make sure the array is long enough
                while (newBestCombination.length < level) {
                    newBestCombination.push(null);
                }
                // Set the new best for this level
                newBestCombination[level - 1] = moves;
                bestCombination = newBestCombination;
            }
        }
        // Update the database
        yield database_1.default.query(`UPDATE game_stats
       SET current_level = $1, best_combination = $2
       WHERE user_id = $3`, [newLevel, JSON.stringify(bestCombination), req.user.id]);
        res.json({
            success: true,
            current_level: newLevel,
            best_combination: bestCombination,
        });
    }
    catch (err) {
        console.error("Game progress update error:", err);
        res.status(500).json({ error: "Database error" });
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
    (0, schema_1.initializeDatabase)()
        .then(() => console.log("✅ Test database initialized"))
        .catch((err) => console.error("❌ Test database initialization failed:", err));
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
            yield database_1.default.query("SELECT 1 FROM users LIMIT 1");
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
