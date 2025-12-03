import cors from "cors";

// Centralized CORS configuration
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Enable credentials for cookies (OAuth state, refresh token)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-Request-ID"],
});
