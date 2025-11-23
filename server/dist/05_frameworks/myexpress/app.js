"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
// Import the directory index explicitly to avoid importing the legacy
// `routes.ts` file. This ensures the new combined router in
// `./routes/index.ts` (which mounts /api/oauth etc.) is used in production.
const index_1 = __importDefault(require("./routes/index"));
// API Gateway Layer - Phase 1A
const gateway_1 = require("./gateway");
// Passport is no longer used - replaced with openid-client for PKCE support
// import passport from "passport";
// import { configurePassport } from "../auth/passport";
console.log("📋 Loading routes...");
// Diagnostic: flag app creation so we can detect multiple app instances
if (global.__souschef_app_created__) {
    console.warn("⚠️ Express app instance already created elsewhere in the process — multiple apps may be running");
}
else {
    global.__souschef_app_created__ = true;
}
console.log("✅ Routes module imported:", typeof index_1.default);
console.log("   Routes is Router?", index_1.default && typeof index_1.default === "function");
console.log("   Routes stack length:", ((_a = index_1.default === null || index_1.default === void 0 ? void 0 : index_1.default.stack) === null || _a === void 0 ? void 0 : _a.length) || 0);
const app = (0, express_1.default)();
// Passport configuration removed - now using openid-client with PKCE
// configurePassport();
app.set("trust proxy", 1);
app.use((0, helmet_1.default)());
// API Gateway Layer - centralizes CORS, logging, rate limiting
app.use((0, gateway_1.createGatewayMiddleware)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Passport removed - using openid-client with PKCE instead
// app.use(passport.initialize());
// Sessions disabled - using JWT tokens instead
// app.use(session(sessionConfig));
// app.use(passport.session());
app.use(index_1.default);
console.log("✅ Routes mounted. App stack layers:", ((_c = (_b = app._router) === null || _b === void 0 ? void 0 : _b.stack) === null || _c === void 0 ? void 0 : _c.length) || 0);
// Print a compact summary of layers and mounted route paths for quick diagnostics
try {
    const entries = ((_e = (_d = app._router) === null || _d === void 0 ? void 0 : _d.stack) === null || _e === void 0 ? void 0 : _e.map((layer, i) => {
        var _a, _b, _c;
        const isRouter = layer.name === "router";
        const prefix = isRouter && layer.regexp
            ? (_a = layer.regexp) === null || _a === void 0 ? void 0 : _a.source
            : ((_b = layer.route) === null || _b === void 0 ? void 0 : _b.path) || "";
        return {
            i,
            name: layer.name,
            path: prefix,
            hasStack: !!((_c = layer.handle) === null || _c === void 0 ? void 0 : _c.stack),
        };
    })) || [];
    console.log("🔍 App router layer summary:", JSON.stringify(entries, null, 2));
}
catch (e) {
    console.error("Failed to summarize app router stack:", e);
}
// Error logging middleware (must be after routes)
app.use(gateway_1.errorLoggingMiddleware);
exports.default = app;
