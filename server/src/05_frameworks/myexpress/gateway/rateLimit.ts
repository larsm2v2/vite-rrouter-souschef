import rateLimit from "express-rate-limit";

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later",
});

// Stricter rate limiter for credential endpoints (login/register): guards against password guessing
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts, please try again later",
});

// Session upkeep (refresh/check/logout). These need a valid token or cookie, and the client
// renews about every 14 minutes, so reloads and several devices on one network must not
// exhaust the budget and look like a lost session.
export const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many session requests, please try again shortly",
});

// Rate limiter for OCR endpoints (can be CPU-intensive)
export const ocrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 OCR requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many OCR requests, please try again later",
});

// Rate limiter for recipe share-token lookup/accept endpoints, to blunt
// brute-forcing of share tokens.
export const shareTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 share-token requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many share link requests, please try again later",
});

// Bound outbound HTML fetches used by recipe URL import.
export const recipeImportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many recipe imports, please try again later",
});
