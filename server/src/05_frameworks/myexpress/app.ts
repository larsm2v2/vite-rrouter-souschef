import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import passport from "passport";
import { configurePassport } from "../auth/passport";
import routes from "./routes";

const app = express();

// Configure passport strategies
configurePassport();

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
app.use(passport.initialize());
// Sessions disabled - using JWT tokens instead
// app.use(session(sessionConfig));
// app.use(passport.session());
app.use(routes);

export default app;
