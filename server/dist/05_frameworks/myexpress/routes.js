"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const profile_1 = __importDefault(require("./routes/profile"));
const recipes_routes_1 = __importDefault(require("./routes/recipes.routes"));
const clean_recipes_routes_1 = __importDefault(require("./routes/clean-recipes.routes"));
const router = (0, express_1.Router)();
router.use("/auth", auth_routes_1.default);
router.use("/profile", profile_1.default);
router.use("/recipes", recipes_routes_1.default);
router.use("/clean-recipes", clean_recipes_routes_1.default);
exports.default = router;
