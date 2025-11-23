"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
exports.loggingMiddleware = loggingMiddleware;
exports.errorLoggingMiddleware = errorLoggingMiddleware;
// Simple request ID generation (can replace with uuid later)
let requestCounter = 0;
function generateRequestId() {
    return `req_${Date.now()}_${++requestCounter}`;
}
// Attach request ID to each request for tracing
function requestIdMiddleware(req, res, next) {
    const requestId = generateRequestId();
    req.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);
    next();
}
// Structured logging middleware with request context
function loggingMiddleware(req, res, next) {
    var _a;
    const startTime = Date.now();
    const requestId = req.requestId || "unknown";
    // Log request
    console.log(JSON.stringify({
        type: "request",
        requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || ((_a = req.connection) === null || _a === void 0 ? void 0 : _a.remoteAddress),
        userAgent: req.headers["user-agent"],
        timestamp: new Date().toISOString(),
    }));
    // Log response when finished
    res.on("finish", () => {
        const duration = Date.now() - startTime;
        console.log(JSON.stringify({
            type: "response",
            requestId,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
        }));
    });
    next();
}
// Error logging middleware
function errorLoggingMiddleware(err, req, res, next) {
    const requestId = req.requestId || "unknown";
    console.error(JSON.stringify({
        type: "error",
        requestId,
        method: req.method,
        url: req.originalUrl,
        error: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        timestamp: new Date().toISOString(),
    }));
    next(err);
}
