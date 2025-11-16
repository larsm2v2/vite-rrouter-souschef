import { Router } from "express";
import crypto from "crypto";
import { Request, Response } from "express";
import express from "express";
import jwt from "jsonwebtoken";
import { hashPassword, comparePassword } from "../../auth/password";
import db from "../../database/connection";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  isRefreshTokenValid,
  revokeRefreshTokenByJti,
} from "../../../utils/jwt";
import { authenticateJWT } from "../jwtAuth";

console.log("📥 Importing auth.routes");
const router = Router();

// Simple test endpoint to verify request body parsing
router.post("/test-body", (req: Request, res: Response) => {
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

// Google OAuth routes removed - now handled by auth-google-pkce.routes.ts with PKCE support

// Protected route example
router.get("/profile", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  res.json(req.user as Express.User);
});

// Logout: revoke refresh token from cookie and clear it
router.post("/logout", async (req, res) => {
  const cookieToken = req.cookies?.refreshToken;
  if (cookieToken) {
    const payload = verifyToken(cookieToken);
    if (payload && payload.jti) {
      await revokeRefreshTokenByJti(payload.jti);
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
});

// Token refresh endpoint: read refresh token from HttpOnly cookie, rotate, and return new access token
router.post("/refresh", async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token required" });
  }

  const check = await isRefreshTokenValid(refreshToken);

  if (!check.valid || !check.payload) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  // Rotate refresh token: revoke old and issue new
  try {
    if (check.payload.jti) {
      await revokeRefreshTokenByJti(check.payload.jti);
    }
  } catch (err) {
    console.error("Failed to revoke old refresh token:", err);
  }

  const newAccessToken = generateAccessToken(
    check.payload.sub,
    check.payload.email,
    check.payload.display_name
  );
  const newRefreshToken = await generateRefreshToken(
    check.payload.sub,
    check.payload.email,
    check.payload.display_name
  );

  // Set new refresh token cookie
  try {
    const decoded: any = jwt.decode(newRefreshToken);
    const expiresMs = decoded?.exp
      ? decoded.exp * 1000 - Date.now()
      : undefined;
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      ...(expiresMs ? { maxAge: expiresMs } : {}),
      path: "/",
    });
  } catch (err) {
    console.error("Failed to set refresh cookie:", err);
  }

  res.json({ accessToken: newAccessToken });
});

// Auth check endpoint
router.get("/check", authenticateJWT, (req: Request, res: Response) => {
  res.json({
    authenticated: true,
    user: req.user,
  });
});

// Registration route
router.post("/register", async (req: Request, res: Response) => {
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
    const emailCheckResult = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (emailCheckResult.rows.length > 0) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Hash password
    const { hash, salt } = await hashPassword(password);

    // Insert new user with password
    const result = await db.query(
      `INSERT INTO users (google_sub, email, password, password_salt, display_name) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, display_name`,
      [null, email, hash, salt, userDisplayName]
    );

    const user = result.rows[0];

    // Generate tokens for auto-login
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

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Login route
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // Find user
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
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
    const isMatch = await comparePassword(
      password,
      user.password,
      user.password_salt
    );

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate tokens instead of creating session
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

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
