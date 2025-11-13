"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const profile_1 = __importDefault(require("./profile"));
const recipes_routes_1 = __importDefault(require("./recipes.routes"));
const grocery_routes_1 = __importDefault(require("./grocery.routes"));
const profileFeatures_routes_1 = __importDefault(require("./profileFeatures.routes"));
const router = express_1.default.Router();
router.use("/auth", auth_routes_1.default);
router.use("/api", recipes_routes_1.default);
router.use("/api", grocery_routes_1.default);
router.use("/", profile_1.default);
router.use("/api", profileFeatures_routes_1.default);
exports.default = router;
