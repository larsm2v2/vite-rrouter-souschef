"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
// Passport is no longer used - replaced with openid-client for PKCE support
// import passport from "passport";
// import { configurePassport } from "../auth/passport";
console.log("📋 Loading routes...");
let routes;
try {
    routes = require("./routes").default;
    console.log("✅ Routes loaded successfully");
}
catch (err) {
    console.error("❌ CRITICAL: Failed to load routes:", err);
    console.error("Stack:", err.stack);
    throw err;
}
const app = (0, express_1.default)();
// Passport configuration removed - now using openid-client with PKCE
// configurePassport();
app.set("trust proxy", 1);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.CLIENT_URL,
            "http://localhost:5173",
            "http://localhost:5174",
        ].filter(Boolean);
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true, // Enable credentials for cookies (OAuth state, refresh token)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"], // Added Authorization header
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Passport removed - using openid-client with PKCE instead
// app.use(passport.initialize());
// Sessions disabled - using JWT tokens instead
// app.use(session(sessionConfig));
// app.use(passport.session());
app.use(routes);
exports.default = app;
