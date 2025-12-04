"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e, _f, _g, _h;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const oauth_google_routes_1 = __importDefault(require("./oauth-google.routes"));
const profile_1 = __importDefault(require("./profile"));
const recipes_routes_1 = __importDefault(require("./recipes.routes"));
const grocery_routes_1 = __importDefault(require("./grocery.routes"));
const profileFeatures_routes_1 = __importDefault(require("./profileFeatures.routes"));
const already_stocked_routes_1 = __importDefault(require("./already-stocked.routes"));
const ocr_1 = __importDefault(require("../../../routes/ocr"));
const router = express_1.default.Router();
console.log("📋 Mounting routes...");
console.log("Environment for routes mount: NODE_ENV=", process.env.NODE_ENV);
// Mount all routes
console.log("  Mounting /api/oauth → oauth-google routes");
router.use("/api/oauth", oauth_google_routes_1.default); // Client-side PKCE token exchange
console.log("    -> oauthGoogleRoutes loaded?", typeof oauth_google_routes_1.default, "stackLength", (_a = oauth_google_routes_1.default === null || oauth_google_routes_1.default === void 0 ? void 0 : oauth_google_routes_1.default.stack) === null || _a === void 0 ? void 0 : _a.length);
console.log("  Mounting /auth → auth routes");
router.use("/auth", auth_routes_1.default); // Traditional auth routes (login, register, refresh, etc.)
console.log("    -> authRoutes loaded?", typeof auth_routes_1.default, "stackLength", (_b = auth_routes_1.default === null || auth_routes_1.default === void 0 ? void 0 : auth_routes_1.default.stack) === null || _b === void 0 ? void 0 : _b.length);
console.log("  Mounting /api/recipes → recipes routes");
router.use("/api/recipes", recipes_routes_1.default);
console.log("    -> recipesRoutes loaded?", typeof recipes_routes_1.default, "stackLength", (_c = recipes_routes_1.default === null || recipes_routes_1.default === void 0 ? void 0 : recipes_routes_1.default.stack) === null || _c === void 0 ? void 0 : _c.length);
// Note: /api/clean-recipes endpoint removed - cleaning now only happens when creating new recipes
console.log("  Mounting /api → grocery routes");
router.use("/api", grocery_routes_1.default);
console.log("    -> groceryRoutes loaded?", typeof grocery_routes_1.default, "stackLength", (_d = grocery_routes_1.default === null || grocery_routes_1.default === void 0 ? void 0 : grocery_routes_1.default.stack) === null || _d === void 0 ? void 0 : _d.length);
console.log("  Mounting / → profile routes");
router.use("/", profile_1.default);
console.log("    -> profileRoutes loaded?", typeof profile_1.default, "stackLength", (_e = profile_1.default === null || profile_1.default === void 0 ? void 0 : profile_1.default.stack) === null || _e === void 0 ? void 0 : _e.length);
console.log("  Mounting /api → profile features routes");
router.use("/api", profileFeatures_routes_1.default);
console.log("    -> profileFeatures loaded?", typeof profileFeatures_routes_1.default, "stackLength", (_f = profileFeatures_routes_1.default === null || profileFeatures_routes_1.default === void 0 ? void 0 : profileFeatures_routes_1.default.stack) === null || _f === void 0 ? void 0 : _f.length);
console.log("  Mounting /api/already-stocked → already stocked routes");
router.use("/api/already-stocked", already_stocked_routes_1.default);
console.log("    -> alreadyStockedRoutes loaded?", typeof already_stocked_routes_1.default, "stackLength", (_g = already_stocked_routes_1.default === null || already_stocked_routes_1.default === void 0 ? void 0 : already_stocked_routes_1.default.stack) === null || _g === void 0 ? void 0 : _g.length);
console.log("  Mounting /api → ocr routes");
router.use("/api", ocr_1.default);
console.log("    -> ocrRoutes loaded?", typeof ocr_1.default, "stackLength", (_h = ocr_1.default === null || ocr_1.default === void 0 ? void 0 : ocr_1.default.stack) === null || _h === void 0 ? void 0 : _h.length);
console.log(`✅ Routes mounted successfully. Total routers: ${router.stack.length}`);
exports.default = router;
