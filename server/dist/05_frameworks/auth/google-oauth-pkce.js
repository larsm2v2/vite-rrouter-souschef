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
exports.initializeGoogleOAuthClient = initializeGoogleOAuthClient;
exports.getGoogleAuthUrl = getGoogleAuthUrl;
exports.handleGoogleCallback = handleGoogleCallback;
console.log("🔵 START: google-oauth-pkce module is loading");
const oauth = __importStar(require("openid-client"));
const crypto_1 = __importDefault(require("crypto"));
// Diagnostic: module load marker and presence checks for required env vars (do NOT print secrets)
console.log("🔵 START: google-oauth-pkce module is loading");
console.log("   GOOGLE_CLIENT_ID present:", !!process.env.GOOGLE_CLIENT_ID);
console.log("   GOOGLE_CLIENT_SECRET present:", !!process.env.GOOGLE_CLIENT_SECRET);
console.log("   GOOGLE_CALLBACK_URL present:", !!process.env.GOOGLE_CALLBACK_URL);
console.log("📦 openid-client imported successfully");
let googleConfig;
// In-memory store for PKCE sessions (use Redis in production for multiple instances)
const pkceStore = new Map();
// Clean up old PKCE sessions (older than 10 minutes)
function cleanupOldSessions() {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, session] of pkceStore.entries()) {
        if (session.timestamp < tenMinutesAgo) {
            pkceStore.delete(key);
        }
    }
}
// Run cleanup every minute
setInterval(cleanupOldSessions, 60 * 1000);
function initializeGoogleOAuthClient() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.GOOGLE_CLIENT_ID ||
            !process.env.GOOGLE_CLIENT_SECRET ||
            !process.env.GOOGLE_CALLBACK_URL) {
            throw new Error("Google OAuth environment variables are not properly defined.");
        }
        console.log("🔧 Initializing Google OAuth with PKCE support");
        console.log("   Callback URL:", process.env.GOOGLE_CALLBACK_URL);
        // Discover Google's OpenID configuration
        const issuerUrl = new URL("https://accounts.google.com");
        const authServer = yield oauth.discovery(issuerUrl, process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
        googleConfig = authServer;
        console.log("✅ Google OAuth client initialized with PKCE");
    });
}
function getGoogleAuthUrl(req) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!googleConfig) {
            throw new Error("Google OAuth not initialized");
        }
        // Generate PKCE parameters
        const codeVerifier = oauth.randomPKCECodeVerifier();
        const codeChallenge = yield oauth.calculatePKCECodeChallenge(codeVerifier);
        const state = oauth.randomState();
        // Create a session ID tied to this specific request
        const sessionId = crypto_1.default.randomBytes(16).toString("hex");
        // Store PKCE parameters with session ID
        pkceStore.set(sessionId, {
            codeVerifier,
            state,
            timestamp: Date.now(),
        });
        // Set session ID in a secure cookie
        // This cookie is first-party and works in Safari
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 10 * 60 * 1000, // 10 minutes
            path: "/",
        };
        // Note: We'll set this cookie in the route handler
        req.__pkceSessionId = sessionId;
        req.__pkceCookieOptions = cookieOptions;
        const authUrl = oauth.buildAuthorizationUrl(googleConfig, {
            redirect_uri: process.env.GOOGLE_CALLBACK_URL,
            scope: "openid email profile",
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            state,
            prompt: "select_account",
        });
        return authUrl.href;
    });
}
function handleGoogleCallback(req) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!googleConfig) {
            throw new Error("Google OAuth not initialized");
        }
        const { code, state } = req.query;
        if (!code || typeof code !== "string") {
            throw new Error("Missing authorization code");
        }
        if (!state || typeof state !== "string") {
            throw new Error("Missing state parameter");
        }
        // Retrieve session ID from cookie
        const sessionId = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.pkce_session;
        if (!sessionId) {
            throw new Error("Missing PKCE session cookie");
        }
        // Retrieve PKCE parameters from store
        const pkceSession = pkceStore.get(sessionId);
        if (!pkceSession) {
            throw new Error("Invalid or expired PKCE session");
        }
        // Verify state matches
        if (pkceSession.state !== state) {
            throw new Error("State mismatch - possible CSRF attack");
        }
        // Clean up the session
        pkceStore.delete(sessionId);
        // Exchange code for tokens using PKCE
        const currentUrl = new URL(req.url, `${req.protocol}://${req.get("host")}`);
        const tokens = yield oauth.authorizationCodeGrant(googleConfig, currentUrl, {
            pkceCodeVerifier: pkceSession.codeVerifier,
            expectedState: pkceSession.state,
        });
        // Get user info - pass empty string for subject parameter
        const claims = yield oauth.fetchUserInfo(googleConfig, tokens.access_token, "");
        return {
            googleId: claims.sub,
            email: claims.email,
            displayName: claims.name,
            avatar: claims.picture,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
        };
    });
}
