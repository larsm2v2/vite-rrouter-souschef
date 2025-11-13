import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../../utils/jwt";

// Express.User is already defined in src/types/express.d.ts with id: number

export const authenticateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const payload = verifyToken(token);

  if (!payload || payload.type !== "access") {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Attach user info to request
  req.user = {
    id: parseInt(payload.sub, 10),
    email: payload.email,
    display_name: payload.display_name,
  };

  next();
};

// Optional middleware for routes that work with or without auth
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload && payload.type === "access") {
      req.user = {
        id: parseInt(payload.sub, 10),
        email: payload.email,
        display_name: payload.display_name,
      };
    }
  }

  next();
};