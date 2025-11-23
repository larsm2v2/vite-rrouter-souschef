// API Gateway Layer - Phase 1A
// Centralizes cross-cutting concerns: logging, CORS, rate limiting, circuit breaking

import express from "express";
import {
  requestIdMiddleware,
  loggingMiddleware,
  errorLoggingMiddleware,
} from "./logging";
import { corsMiddleware } from "./cors";
import { apiLimiter } from "./rateLimit";

export function createGatewayMiddleware() {
  const router = express.Router();

  // Apply cross-cutting concerns in order
  router.use(requestIdMiddleware); // Assign unique request ID
  router.use(loggingMiddleware); // Log all requests/responses
  router.use(corsMiddleware); // CORS headers
  router.use(apiLimiter); // Rate limiting (general)

  return router;
}

// Export individual middleware for selective use
export {
  requestIdMiddleware,
  loggingMiddleware,
  errorLoggingMiddleware,
} from "./logging";
export { corsMiddleware } from "./cors";
export { apiLimiter, authLimiter, ocrLimiter } from "./rateLimit";
export {
  callWithCircuitBreaker,
  CircuitBreakerError,
  recordSuccess,
  recordFailure,
} from "./circuitBreaker";
