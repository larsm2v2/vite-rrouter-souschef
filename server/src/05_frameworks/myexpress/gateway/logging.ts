import { Request, Response, NextFunction } from "express";

// Simple request ID generation (can replace with uuid later)
let requestCounter = 0;
function generateRequestId(): string {
  return `req_${Date.now()}_${++requestCounter}`;
}

// Attach request ID to each request for tracing
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = generateRequestId();
  (req as any).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}

// Structured logging middleware with request context
export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const startTime = Date.now();
  const requestId = (req as any).requestId || "unknown";

  // Log request
  console.log(
    JSON.stringify({
      type: "request",
      requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
      timestamp: new Date().toISOString(),
    }),
  );

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log(
      JSON.stringify({
        type: "response",
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      }),
    );
  });

  next();
}

// Error logging middleware
export function errorLoggingMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = (req as any).requestId || "unknown";

  console.error(
    JSON.stringify({
      type: "error",
      requestId,
      method: req.method,
      url: req.originalUrl,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    }),
  );

  next(err);
}

// Centralized error-response middleware. Must be registered last, after
// errorLoggingMiddleware. Without this, unhandled errors fall through to
// Express's built-in default error handler, which sends an HTML response
// (not JSON) and, when NODE_ENV isn't exactly "production", includes the
// error stack trace in the response body.
export function errorResponseMiddleware(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  const requestId = (req as any).requestId || "unknown";

  res.status(statusCode).json({
    error:
      statusCode >= 500 && process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
    requestId,
  });
}
