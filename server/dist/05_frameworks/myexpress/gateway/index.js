"use strict";
// API Gateway Layer - Phase 1A
// Centralizes cross-cutting concerns: logging, CORS, rate limiting, circuit breaking
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordFailure = exports.recordSuccess = exports.CircuitBreakerError = exports.callWithCircuitBreaker = exports.ocrLimiter = exports.authLimiter = exports.apiLimiter = exports.corsMiddleware = exports.errorLoggingMiddleware = exports.loggingMiddleware = exports.requestIdMiddleware = void 0;
exports.createGatewayMiddleware = createGatewayMiddleware;
const express_1 = __importDefault(require("express"));
const logging_1 = require("./logging");
const cors_1 = require("./cors");
const rateLimit_1 = require("./rateLimit");
function createGatewayMiddleware() {
    const router = express_1.default.Router();
    // Apply cross-cutting concerns in order
    router.use(logging_1.requestIdMiddleware); // Assign unique request ID
    router.use(logging_1.loggingMiddleware); // Log all requests/responses
    router.use(cors_1.corsMiddleware); // CORS headers
    router.use(rateLimit_1.apiLimiter); // Rate limiting (general)
    return router;
}
// Export individual middleware for selective use
var logging_2 = require("./logging");
Object.defineProperty(exports, "requestIdMiddleware", { enumerable: true, get: function () { return logging_2.requestIdMiddleware; } });
Object.defineProperty(exports, "loggingMiddleware", { enumerable: true, get: function () { return logging_2.loggingMiddleware; } });
Object.defineProperty(exports, "errorLoggingMiddleware", { enumerable: true, get: function () { return logging_2.errorLoggingMiddleware; } });
var cors_2 = require("./cors");
Object.defineProperty(exports, "corsMiddleware", { enumerable: true, get: function () { return cors_2.corsMiddleware; } });
var rateLimit_2 = require("./rateLimit");
Object.defineProperty(exports, "apiLimiter", { enumerable: true, get: function () { return rateLimit_2.apiLimiter; } });
Object.defineProperty(exports, "authLimiter", { enumerable: true, get: function () { return rateLimit_2.authLimiter; } });
Object.defineProperty(exports, "ocrLimiter", { enumerable: true, get: function () { return rateLimit_2.ocrLimiter; } });
var circuitBreaker_1 = require("./circuitBreaker");
Object.defineProperty(exports, "callWithCircuitBreaker", { enumerable: true, get: function () { return circuitBreaker_1.callWithCircuitBreaker; } });
Object.defineProperty(exports, "CircuitBreakerError", { enumerable: true, get: function () { return circuitBreaker_1.CircuitBreakerError; } });
Object.defineProperty(exports, "recordSuccess", { enumerable: true, get: function () { return circuitBreaker_1.recordSuccess; } });
Object.defineProperty(exports, "recordFailure", { enumerable: true, get: function () { return circuitBreaker_1.recordFailure; } });
