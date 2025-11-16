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
const jwt_1 = require("../../../utils/jwt");
const connection_1 = __importDefault(require("../../database/connection"));
const crypto_1 = require("../../../utils/crypto");
const router = (0, express_1.Router)();
/**
 * Stateless OAuth token exchange endpoint
 *
 * This endpoint receives the authorization code and PKCE verifier from the client,
 * exchanges them with Google for tokens, and returns JWT tokens to the client.
 *
 * NO server-side session storage is used - fully stateless!
 */
router.post("/google/token", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { code, code_verifier } = req.body;
        // Validate request
        if (!code || !code_verifier) {
            return res.status(400).json({
                error: "Missing required parameters: code and code_verifier are required",
            });
        }
        // Validate environment variables
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            console.error("Missing Google OAuth environment variables");
            return res.status(500).json({
                error: "OAuth is not properly configured on the server",
            });
        }
        // Exchange authorization code for tokens with Google
        // The code_verifier is sent directly from the client!
        const tokenResponse = yield fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                code,
                code_verifier, // Client-generated PKCE verifier
                redirect_uri: process.env.GOOGLE_CALLBACK_URL ||
                    `${process.env.CLIENT_URL}/auth/callback`,
                grant_type: "authorization_code",
            }),
        });
        if (!tokenResponse.ok) {
            const errorData = yield tokenResponse.json();
            console.error("Google token exchange failed:", errorData);
            return res.status(400).json({
                error: "Failed to exchange authorization code with Google",
                details: errorData.error_description || errorData.error,
            });
        }
        const tokens = yield tokenResponse.json();
        // Get user info from Google
        const userInfoResponse = yield fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });
        if (!userInfoResponse.ok) {
            console.error("Failed to fetch user info from Google");
            return res.status(500).json({
                error: "Failed to retrieve user information from Google",
            });
        }
        const userInfo = yield userInfoResponse.json();
        // Find or create user in database
        let user;
        const userResult = yield connection_1.default.query(`SELECT id, google_sub, email, display_name 
       FROM users 
       WHERE google_sub = $1`, [userInfo.sub]);
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
                userInfo.sub,
                userInfo.email,
                userInfo.name,
                userInfo.picture,
                tokens.access_token ? (0, crypto_1.encryptToken)(tokens.access_token) : null,
                tokens.refresh_token ? (0, crypto_1.encryptToken)(tokens.refresh_token) : null,
                tokenExpiry.toISOString(),
            ]);
            const newUserResult = yield connection_1.default.query(`SELECT id, email, display_name 
         FROM users 
         WHERE id = $1`, [insertResult.rows[0].id]);
            user = newUserResult.rows[0];
        }
        else {
            // Update existing user's Google tokens
            const tokenExpiry = new Date();
            tokenExpiry.setHours(tokenExpiry.getHours() + 1);
            yield connection_1.default.query(`UPDATE users 
         SET google_access_token = $1,
             google_refresh_token = $2,
             token_expiry = $3,
             avatar = $4,
             display_name = $5
         WHERE id = $6`, [
                tokens.access_token ? (0, crypto_1.encryptToken)(tokens.access_token) : null,
                tokens.refresh_token ? (0, crypto_1.encryptToken)(tokens.refresh_token) : null,
                tokenExpiry.toISOString(),
                userInfo.picture,
                userInfo.name,
                user.id,
            ]);
        }
        // Generate our app's JWT tokens
        const accessToken = (0, jwt_1.generateAccessToken)(user.id, user.email, user.display_name);
        const refreshToken = yield (0, jwt_1.generateRefreshToken)(user.id, user.email, user.display_name);
        // Set refresh token as HTTP-only cookie
        const decoded = require("jsonwebtoken").decode(refreshToken);
        const expiresMs = (decoded === null || decoded === void 0 ? void 0 : decoded.exp)
            ? decoded.exp * 1000 - Date.now()
            : 7 * 24 * 60 * 60 * 1000; // Default 7 days
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: expiresMs,
            path: "/",
        });
        // Return access token to client
        res.json({
            access_token: accessToken,
            user: {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
            },
        });
    }
    catch (error) {
        console.error("OAuth token exchange error:", error);
        res.status(500).json({
            error: "Internal server error during OAuth token exchange",
        });
    }
}));
exports.default = router;
