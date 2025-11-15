"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
console.log("[ROUTES INDEX] START: routes/index.ts module is loading");
const express_1 = __importDefault(require("express"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
console.log("[ROUTES INDEX] About to import auth-google-pkce.routes...");
const auth_google_pkce_routes_1 = __importDefault(require("./auth-google-pkce.routes"));
console.log("[ROUTES INDEX] auth-google-pkce.routes imported:", typeof auth_google_pkce_routes_1.default);
const profile_1 = __importDefault(require("./profile"));
const recipes_routes_1 = __importDefault(require("./recipes.routes"));
const grocery_routes_1 = __importDefault(require("./grocery.routes"));
const profileFeatures_routes_1 = __importDefault(require("./profileFeatures.routes"));
console.log("[ROUTES INDEX] All route modules imported. Creating router...");
const router = express_1.default.Router();
console.log("[ROUTES INDEX] Mounting routes to router...");
// Use PKCE-enabled Google OAuth routes (replaces passport-google-oauth20)
router.use("/auth", auth_google_pkce_routes_1.default);
console.log("[ROUTES INDEX] Mounted authGooglePkceRoutes on /auth");
router.use("/auth", auth_routes_1.default); // Keep other auth routes (login, register, refresh, etc.)
console.log("[ROUTES INDEX] Mounted authRoutes on /auth");
router.use("/api", recipes_routes_1.default);
console.log("[ROUTES INDEX] Mounted recipesRoutes on /api");
router.use("/api", grocery_routes_1.default);
console.log("[ROUTES INDEX] Mounted groceryRoutes on /api");
router.use("/", profile_1.default);
console.log("[ROUTES INDEX] Mounted profileRoutes on /");
router.use("/api", profileFeatures_routes_1.default);
console.log("[ROUTES INDEX] Mounted profileFeatures on /api");
console.log(`[ROUTES INDEX] Router complete. Stack length: ${router.stack.length}`);
exports.default = router;
