console.log("🔵 START: google-oauth-pkce module is loading");

import * as oauth from "openid-client";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// Diagnostic: module load marker and presence checks for required env vars (do NOT print secrets)
console.log("🔵 START: google-oauth-pkce module is loading");
console.log("   GOOGLE_CLIENT_ID present:", !!process.env.GOOGLE_CLIENT_ID);
console.log("   GOOGLE_CLIENT_SECRET present:", !!process.env.GOOGLE_CLIENT_SECRET);
console.log("   GOOGLE_CALLBACK_URL present:", !!process.env.GOOGLE_CALLBACK_URL);

console.log("📦 openid-client imported successfully");

let googleConfig: oauth.Configuration;

interface PKCESession {
  codeVerifier: string;
  state: string;
  timestamp: number;
}

// In-memory store for PKCE sessions (use Redis in production for multiple instances)
const pkceStore = new Map<string, PKCESession>();

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

export async function initializeGoogleOAuthClient() {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_CALLBACK_URL
  ) {
    throw new Error(
      "Google OAuth environment variables are not properly defined."
    );
  }

  console.log("🔧 Initializing Google OAuth with PKCE support");
  console.log("   Callback URL:", process.env.GOOGLE_CALLBACK_URL);

  // Discover Google's OpenID configuration
  const issuerUrl = new URL("https://accounts.google.com");
  const authServer = await oauth.discovery(
    issuerUrl,
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  googleConfig = authServer;

  console.log("✅ Google OAuth client initialized with PKCE");
}

export async function getGoogleAuthUrl(req: Request): Promise<string> {
  if (!googleConfig) {
    throw new Error("Google OAuth not initialized");
  }

  // Generate PKCE parameters
  const codeVerifier = oauth.randomPKCECodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.randomState();

  // Create a session ID tied to this specific request
  const sessionId = crypto.randomBytes(16).toString("hex");

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
  } as const;

  // Note: We'll set this cookie in the route handler
  (req as any).__pkceSessionId = sessionId;
  (req as any).__pkceCookieOptions = cookieOptions;

  const authUrl = oauth.buildAuthorizationUrl(googleConfig, {
    redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
    scope: "openid email profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    prompt: "select_account",
  });

  return authUrl.href;
}

export async function handleGoogleCallback(req: Request): Promise<any> {
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
  const sessionId = req.cookies?.pkce_session;
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
  const tokens = await oauth.authorizationCodeGrant(googleConfig, currentUrl, {
    pkceCodeVerifier: pkceSession.codeVerifier,
    expectedState: pkceSession.state,
  });

  // Get user info - pass empty string for subject parameter
  const claims = await oauth.fetchUserInfo(
    googleConfig,
    tokens.access_token,
    ""
  );

  return {
    googleId: claims.sub as string,
    email: claims.email as string,
    displayName: claims.name as string,
    avatar: claims.picture as string,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}
