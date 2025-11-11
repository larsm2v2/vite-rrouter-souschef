import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

export const loggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
};

export const errorHandlingMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
};

// Rate limiter for auth-related endpoints (migrated from src/middleware/rateLimit.ts)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts, please try again later",
});
