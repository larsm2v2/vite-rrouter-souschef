"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authLimiter = exports.errorHandlingMiddleware = exports.loggingMiddleware = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const loggingMiddleware = (req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
};
exports.loggingMiddleware = loggingMiddleware;
const errorHandlingMiddleware = (err, req, res, next) => {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal Server Error" });
};
exports.errorHandlingMiddleware = errorHandlingMiddleware;
// Rate limiter for auth-related endpoints (migrated from src/middleware/rateLimit.ts)
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many login attempts, please try again later",
});
