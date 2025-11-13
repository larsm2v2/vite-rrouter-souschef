import jwt, { SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";
import db from "../05_frameworks/database/connection";

const JWT_SECRET: string = process.env.JWT_SECRET || "fallback-secret-change-me";
const ACCESS_EXPIRATION: string = process.env.JWT_ACCESS_EXPIRATION || "15m";
const REFRESH_EXPIRATION: string = process.env.JWT_REFRESH_EXPIRATION || "7d";

export interface TokenPayload {
  sub: string; // User ID
  email: string;
  display_name: string;
  type: "access" | "refresh";
  jti?: string;
}

export const generateAccessToken = (
  userId: number | string,
  email: string,
  displayName: string
): string => {
  return jwt.sign(
    {
      sub: String(userId),
      email,
      display_name: displayName,
      type: "access" as const,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRATION } as SignOptions
  );
};

// Generate a refresh token and persist it to the database (allowlist)
export const generateRefreshToken = async (
  userId: number | string,
  email: string,
  displayName: string
): Promise<string> => {
  const jti = randomUUID();
  const token = jwt.sign(
    {
      sub: String(userId),
      email,
      display_name: displayName,
      type: "refresh" as const,
      jti,
    },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRATION } as SignOptions
  );

  // Decode token to get exp claim (seconds since epoch)
  const decoded = jwt.decode(token) as any;
  const exp = decoded?.exp || null; // exp is in seconds

  try {
    await db.query(
      `INSERT INTO refresh_tokens (jti, token, user_id, expires_at) VALUES ($1, $2, $3, to_timestamp($4))`,
      [jti, token, userId, exp]
    );
  } catch (err) {
    console.error("Failed to persist refresh token:", err);
    // Note: We don't throw here to avoid breaking login flow; operators should monitor failures.
  }

  return token;
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
};

export const isRefreshTokenValid = async (token: string): Promise<{ valid: boolean; payload?: TokenPayload }> => {
  const payload = verifyToken(token);
  if (!payload || payload.type !== "refresh" || !payload.jti) {
    return { valid: false };
  }

  try {
    const res = await db.query(
      `SELECT 1 FROM refresh_tokens WHERE jti = $1 AND token = $2 AND revoked = false AND expires_at > NOW() LIMIT 1`,
      [payload.jti, token]
    );
    return { valid: res.rows.length > 0, payload };
  } catch (err) {
    console.error("Error checking refresh token validity:", err);
    return { valid: false };
  }
};

export const revokeRefreshTokenByJti = async (jti: string) => {
  try {
    await db.query(`UPDATE refresh_tokens SET revoked = true WHERE jti = $1`, [jti]);
  } catch (err) {
    console.error("Failed to revoke refresh token:", err);
  }
};
