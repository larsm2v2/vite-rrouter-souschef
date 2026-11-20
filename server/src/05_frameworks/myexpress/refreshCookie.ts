import type { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "__session";
const LEGACY_COOKIE_NAME = "refreshToken";

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
});

export function readRefreshCookie(req: Request): string | undefined {
  const current: unknown = req.cookies?.[COOKIE_NAME];
  if (typeof current === "string") return current;
  const legacy: unknown = req.cookies?.[LEGACY_COOKIE_NAME];
  return typeof legacy === "string" ? legacy : undefined;
}

export function setRefreshCookie(res: Response, token: string): void {
  const payload = jwt.decode(token);
  if (!payload || typeof payload === "string" || typeof payload.exp !== "number") {
    throw new Error("Cannot set a refresh cookie without a token expiry");
  }
  const options = { ...cookieOptions(), maxAge: payload.exp * 1000 - Date.now() };
  res.set("Cache-Control", "private, no-store");
  // Firebase Hosting forwards only __session; keep the old name for existing clients.
  res.cookie(COOKIE_NAME, token, options);
  res.cookie(LEGACY_COOKIE_NAME, token, options);
}

export function clearRefreshCookie(res: Response): void {
  res.set("Cache-Control", "private, no-store");
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.clearCookie(LEGACY_COOKIE_NAME, cookieOptions());
}
