"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const oauth_google_routes_1 = __importDefault(require("./oauth-google.routes"));
const profile_1 = __importDefault(require("./profile"));
const recipes_routes_1 = __importDefault(require("./recipes.routes"));
const grocery_routes_1 = __importDefault(require("./grocery.routes"));
const profileFeatures_routes_1 = __importDefault(require("./profileFeatures.routes"));
const router = express_1.default.Router();
// Mount all routes
router.use("/api/oauth", oauth_google_routes_1.default); // Client-side PKCE token exchange
router.use("/auth", auth_routes_1.default); // Traditional auth routes (login, register, refresh, etc.)
router.use("/api", recipes_routes_1.default);
router.use("/api", grocery_routes_1.default);
router.use("/", profile_1.default);
router.use("/api", profileFeatures_routes_1.default);
console.log(`Routes mounted successfully. Total routers: ${router.stack.length}`);
exports.default = router;
