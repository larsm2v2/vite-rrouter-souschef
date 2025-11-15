console.log("[AUTH-GOOGLE-PKCE] START: module loading");

import { Router, Request, Response } from "express";
import {
  initializeGoogleOAuthClient,
  getGoogleAuthUrl,
  handleGoogleCallback,
} from "../../auth/google-oauth-pkce";
import { generateAccessToken, generateRefreshToken } from "../../../utils/jwt";
import db from "../../database/connection";
import { encryptToken } from "../../../utils/crypto";

console.log("[AUTH-GOOGLE-PKCE] Imports complete");
console.log("[AUTH-GOOGLE-PKCE] CLIENT_URL present:", !!process.env.CLIENT_URL);
console.log(
  "[AUTH-GOOGLE-PKCE] GOOGLE_CALLBACK_URL present:",
  !!process.env.GOOGLE_CALLBACK_URL
);

const router = Router();
console.log("[AUTH-GOOGLE-PKCE] Router created");

// Test route to verify this router is mounted
router.get("/test-pkce", (req: Request, res: Response) => {
  res.json({
    message: "auth-google-pkce router is working!",
    timestamp: new Date().toISOString(),
  });
});

// Initialize Google OAuth on module load
console.log("[AUTH-GOOGLE-PKCE] Initializing OAuth client (async)");
(async () => {
  try {
    await initializeGoogleOAuthClient();
    console.log("[AUTH-GOOGLE-PKCE] OAuth client initialized successfully");
  } catch (err) {
    console.error(
      "[AUTH-GOOGLE-PKCE] CRITICAL: Failed to initialize Google OAuth:",
      err
    );
    console.error("[AUTH-GOOGLE-PKCE] Stack:", (err as Error).stack);
  }
})();

console.log("[AUTH-GOOGLE-PKCE] Defining /google route");
// Initiate Google OAuth with PKCE
router.get("/google", async (req: Request, res: Response) => {
  try {
    const authUrl = await getGoogleAuthUrl(req);

    // Set PKCE session cookie (first-party, works in Safari)
    const sessionId = (req as any).__pkceSessionId;
    const cookieOptions = (req as any).__pkceCookieOptions;

    if (sessionId && cookieOptions) {
      res.cookie("pkce_session", sessionId, cookieOptions);
    }

    res.redirect(authUrl);
  } catch (error) {
    console.error("OAuth initiation error:", error);
    res.redirect(process.env.CLIENT_URL + "/login?error=oauth_init_failed");
  }
});

console.log("[AUTH-GOOGLE-PKCE] Defining /google/callback route");
// Google OAuth callback with PKCE
router.get("/google/callback", async (req: Request, res: Response) => {
  try {
    // Handle the callback and get user info
    const oauthUser = await handleGoogleCallback(req);

    // Clear PKCE session cookie
    res.clearCookie("pkce_session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    // Find or create user in database
    let user;
    const userResult = await db.query(
      `SELECT id, google_sub, email, display_name 
       FROM users 
       WHERE google_sub = $1`,
      [oauthUser.googleId]
    );

    user = userResult.rows[0];

    if (!user) {
      // Create new user
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 1);

      const insertResult = await db.query(
        `INSERT INTO users (
          google_sub, 
          email, 
          display_name, 
          avatar, 
          google_access_token,
          google_refresh_token,
          token_expiry
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          oauthUser.googleId,
          oauthUser.email,
          oauthUser.displayName,
          oauthUser.avatar,
          oauthUser.accessToken ? encryptToken(oauthUser.accessToken) : null,
          oauthUser.refreshToken ? encryptToken(oauthUser.refreshToken) : null,
          tokenExpiry.toISOString(),
        ]
      );

      const newUserResult = await db.query(
        `SELECT id, email, display_name 
         FROM users 
         WHERE id = $1`,
        [insertResult.rows[0].id]
      );

      user = newUserResult.rows[0];
    }

    // Generate JWT tokens
    const accessToken = generateAccessToken(
      user.id,
      user.email,
      user.display_name
    );
    const refreshToken = await generateRefreshToken(
      user.id,
      user.email,
      user.display_name
    );

    // Set refresh token as secure HTTP-only cookie
    const decoded: any = require("jsonwebtoken").decode(refreshToken);
    const expiresMs = decoded?.exp
      ? decoded.exp * 1000 - Date.now()
      : undefined;

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      ...(expiresMs ? { maxAge: expiresMs } : {}),
      path: "/",
    });

    // Redirect to client with access token
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    res.redirect(`${clientUrl}/auth/callback#access_token=${accessToken}`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.redirect(process.env.CLIENT_URL + "/login?error=oauth_callback_failed");
  }
});

console.log(
  "[AUTH-GOOGLE-PKCE] Routes defined. Router stack length:",
  router.stack.length
);
console.log("[AUTH-GOOGLE-PKCE] Exporting router");
export default router;
