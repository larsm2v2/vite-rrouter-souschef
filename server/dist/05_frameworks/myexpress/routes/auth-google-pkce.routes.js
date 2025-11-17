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
const google_oauth_pkce_1 = require("../../auth/google-oauth-pkce");
const jwt_1 = require("../../../utils/jwt");
const connection_1 = __importDefault(require("../../database/connection"));
const crypto_1 = require("../../../utils/crypto");
console.log("📥 Importing auth-google-pkce.routes");
const router = (0, express_1.Router)();
// Test route to verify this router is mounted
router.get("/test-pkce", (req, res) => {
    res.json({
        message: "auth-google-pkce router is working!",
        timestamp: new Date().toISOString(),
    });
});
// Initiate Google OAuth with PKCE
router.get("/google", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authUrl = yield (0, google_oauth_pkce_1.getGoogleAuthUrl)(req);
        // Set PKCE session cookie (first-party, works in Safari)
        const sessionId = req.__pkceSessionId;
        const cookieOptions = req.__pkceCookieOptions;
        if (sessionId && cookieOptions) {
            res.cookie("pkce_session", sessionId, cookieOptions);
        }
        res.redirect(authUrl);
    }
    catch (error) {
        console.error("OAuth initiation error:", error);
        res.redirect(process.env.CLIENT_URL + "/login?error=oauth_init_failed");
    }
}));
// Google OAuth callback with PKCE
router.get("/google/callback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Handle the callback and get user info
        const oauthUser = yield (0, google_oauth_pkce_1.handleGoogleCallback)(req);
        // Clear PKCE session cookie
        res.clearCookie("pkce_session", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
        });
        // Find or create user in database
        let user;
        const userResult = yield connection_1.default.query(`SELECT id, google_sub, email, display_name 
       FROM users 
       WHERE google_sub = $1`, [oauthUser.googleId]);
        user = userResult.rows[0];
        if (!user) {
            // Create new user
            const tokenExpiry = new Date();
            tokenExpiry.setHours(tokenExpiry.getHours() + 1);
            const insertResult = yield connection_1.default.query(`INSERT INTO users (
          google_sub, 
          email, 
          display_name, 
          avatar, 
          google_access_token,
          google_refresh_token,
          token_expiry
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`, [
                oauthUser.googleId,
                oauthUser.email,
                oauthUser.displayName,
                oauthUser.avatar,
                oauthUser.accessToken ? (0, crypto_1.encryptToken)(oauthUser.accessToken) : null,
                oauthUser.refreshToken ? (0, crypto_1.encryptToken)(oauthUser.refreshToken) : null,
                tokenExpiry.toISOString(),
            ]);
            const newUserResult = yield connection_1.default.query(`SELECT id, email, display_name 
         FROM users 
         WHERE id = $1`, [insertResult.rows[0].id]);
            user = newUserResult.rows[0];
        }
        // Generate JWT tokens
        const accessToken = (0, jwt_1.generateAccessToken)(user.id, user.email, user.display_name);
        const refreshToken = yield (0, jwt_1.generateRefreshToken)(user.id, user.email, user.display_name);
        // Set refresh token as secure HTTP-only cookie
        const decoded = require("jsonwebtoken").decode(refreshToken);
        const expiresMs = (decoded === null || decoded === void 0 ? void 0 : decoded.exp)
            ? decoded.exp * 1000 - Date.now()
            : undefined;
        res.cookie("refreshToken", refreshToken, Object.assign(Object.assign({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax" }, (expiresMs ? { maxAge: expiresMs } : {})), { path: "/" }));
        // Redirect to client with access token
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        res.redirect(`${clientUrl}/auth/callback#access_token=${accessToken}`);
    }
    catch (error) {
        console.error("OAuth callback error:", error);
        res.redirect(process.env.CLIENT_URL + "/login?error=oauth_callback_failed");
    }
}));
exports.default = router;
