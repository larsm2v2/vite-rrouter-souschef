"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authenticateJWT = void 0;
const jwt_1 = require("../../utils/jwt");
// Express.User is already defined in src/types/express.d.ts with id: number
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
    }
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = (0, jwt_1.verifyToken)(token);
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
exports.authenticateJWT = authenticateJWT;
// Optional middleware for routes that work with or without auth
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const payload = (0, jwt_1.verifyToken)(token);
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
exports.optionalAuth = optionalAuth;
