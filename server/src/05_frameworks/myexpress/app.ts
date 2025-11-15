import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import routes from "./routes";
// Passport is no longer used - replaced with openid-client for PKCE support
// import passport from "passport";
// import { configurePassport } from "../auth/passport";

console.log("📋 Loading routes...");
console.log("✅ Routes module imported:", typeof routes);
console.log("   Routes is Router?", routes && typeof routes === "function");
console.log("   Routes stack length:", routes?.stack?.length || 0);

const app = express();

// Passport configuration removed - now using openid-client with PKCE
// configurePassport();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.CLIENT_URL,
        "http://localhost:5173",
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
    allowedHeaders: ["Content-Type", "Authorization"], // Added Authorization header
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Passport removed - using openid-client with PKCE instead
// app.use(passport.initialize());
// Sessions disabled - using JWT tokens instead
// app.use(session(sessionConfig));
// app.use(passport.session());
app.use(routes);
console.log(
  "✅ Routes mounted. App stack layers:",
  app._router?.stack?.length || 0
);

export default app;
