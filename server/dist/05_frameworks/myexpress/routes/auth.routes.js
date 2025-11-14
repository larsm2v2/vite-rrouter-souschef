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
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const password_1 = require("../../auth/password");
const connection_1 = __importDefault(require("../../database/connection"));
const jwt_1 = require("../../../utils/jwt");
const jwtAuth_1 = require("../jwtAuth");
const router = (0, express_1.Router)();
// Simple test endpoint to verify request body parsing
router.post("/test-body", (req, res) => {
    console.log("Test body endpoint hit");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("Body type:", typeof req.body);
    res.status(200).json({
        receivedBody: req.body,
        bodyKeys: Object.keys(req.body),
        contentType: req.headers["content-type"],
    });
});
// Initiate Google auth
router.get("/google", (req, res, next) => {
    // Generate random state for OAuth
    const state = crypto_1.default.randomBytes(16).toString("hex");
    req.session.oauthState = state;
    passport_1.default.authenticate("google", {
        state,
        prompt: "select_account", // Force account selection
    })(req, res, next);
});
// Google callback
router.get("/google/callback", (req, res, next) => {
    console.log("OAuth callback received:", {
        state: req.query.state,
        code: typeof req.query.code === "string"
            ? req.query.code.substring(0, 10) + "..."
            : req.query.code,
        error: req.query.error,
    });
    next();
}, passport_1.default.authenticate("google", {
    failureRedirect: process.env.CLIENT_URL + "/login?error=auth_failed",
    failureMessage: true,
    session: false, // IMPORTANT: Disable session
}), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return res.redirect(process.env.CLIENT_URL + "/login?error=no_user");
    }
    const user = req.user;
    // Generate tokens instead of creating session
    const accessToken = (0, jwt_1.generateAccessToken)(user.id, user.email, user.display_name);
    const refreshToken = yield (0, jwt_1.generateRefreshToken)(user.id, user.email, user.display_name);
    // Set refresh token as Secure, HttpOnly cookie and redirect with only access token
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    try {
        const decoded = jsonwebtoken_1.default.decode(refreshToken);
        const expiresMs = (decoded === null || decoded === void 0 ? void 0 : decoded.exp)
            ? decoded.exp * 1000 - Date.now()
            : undefined;
        res.cookie("refreshToken", refreshToken, Object.assign({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax" }, (expiresMs ? { maxAge: expiresMs } : {})));
    }
    catch (err) {
        console.error("Failed to set refresh cookie:", err);
    }
    // Redirect with access token only (in fragment)
    res.redirect(`${clientUrl}/auth/callback#access_token=${accessToken}`);
}));
// Protected route example
router.get("/profile", (req, res) => {
    if (!req.user)
        return res.status(401).json({ error: "Unauthorized" });
    res.json(req.user);
});
// Logout: revoke refresh token from cookie and clear it
router.post("/logout", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const cookieToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken;
    if (cookieToken) {
        const payload = (0, jwt_1.verifyToken)(cookieToken);
        if (payload && payload.jti) {
            yield (0, jwt_1.revokeRefreshTokenByJti)(payload.jti);
        }
    }
    // Clear cookie on logout
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
    });
    res.json({ message: "Logged out successfully" });
}));
// Token refresh endpoint: read refresh token from HttpOnly cookie, rotate, and return new access token
router.post("/refresh", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const refreshToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token required" });
    }
    const check = yield (0, jwt_1.isRefreshTokenValid)(refreshToken);
    if (!check.valid || !check.payload) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
    // Rotate refresh token: revoke old and issue new
    try {
        if (check.payload.jti) {
            yield (0, jwt_1.revokeRefreshTokenByJti)(check.payload.jti);
        }
    }
    catch (err) {
        console.error("Failed to revoke old refresh token:", err);
    }
    const newAccessToken = (0, jwt_1.generateAccessToken)(check.payload.sub, check.payload.email, check.payload.display_name);
    const newRefreshToken = yield (0, jwt_1.generateRefreshToken)(check.payload.sub, check.payload.email, check.payload.display_name);
    // Set new refresh token cookie
    try {
        const decoded = jsonwebtoken_1.default.decode(newRefreshToken);
        const expiresMs = (decoded === null || decoded === void 0 ? void 0 : decoded.exp)
            ? decoded.exp * 1000 - Date.now()
            : undefined;
        res.cookie("refreshToken", newRefreshToken, Object.assign(Object.assign({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax" }, (expiresMs ? { maxAge: expiresMs } : {})), { path: "/" }));
    }
    catch (err) {
        console.error("Failed to set refresh cookie:", err);
    }
    res.json({ accessToken: newAccessToken });
}));
// Auth check endpoint
router.get("/check", jwtAuth_1.authenticateJWT, (req, res) => {
    res.json({
        authenticated: true,
        user: req.user,
    });
});
// Registration route
router.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Extract fields
        const { email, password, display_name } = req.body;
        console.log("Registration request:", {
            email: email,
            hasPassword: !!password,
            display_name: display_name,
        });
        // Basic validation
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        if (!password) {
            return res.status(400).json({ message: "Password is required" });
        }
        // Use email as display name if not provided
        const userDisplayName = display_name || email.split("@")[0];
        // Check if email already exists
        const emailCheckResult = yield connection_1.default.query("SELECT * FROM users WHERE email = $1", [email]);
        if (emailCheckResult.rows.length > 0) {
            return res.status(400).json({ message: "Email already in use" });
        }
        // Hash password
        const { hash, salt } = yield (0, password_1.hashPassword)(password);
        // Insert new user with password
        const result = yield connection_1.default.query(`INSERT INTO users (google_sub, email, password, password_salt, display_name) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, display_name`, [null, email, hash, salt, userDisplayName]);
        const user = result.rows[0];
        // Generate tokens for auto-login
        const accessToken = (0, jwt_1.generateAccessToken)(user.id, user.email, user.display_name);
        const refreshToken = yield (0, jwt_1.generateRefreshToken)(user.id, user.email, user.display_name);
        res.status(201).json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
            },
        });
    }
    catch (err) {
        console.error("Registration error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
}));
// Login route
router.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password required" });
        }
        // Find user
        const result = yield connection_1.default.query("SELECT * FROM users WHERE email = $1", [
            email,
        ]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const user = result.rows[0];
        // Check if this is a password-based account
        if (!user.password || !user.password_salt) {
            return res
                .status(401)
                .json({ message: "This account uses Google login" });
        }
        // Verify password
        const isMatch = yield (0, password_1.comparePassword)(password, user.password, user.password_salt);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        // Generate tokens instead of creating session
        const accessToken = (0, jwt_1.generateAccessToken)(user.id, user.email, user.display_name);
        const refreshToken = yield (0, jwt_1.generateRefreshToken)(user.id, user.email, user.display_name);
        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
            },
        });
    }
    catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
}));
exports.default = router;
