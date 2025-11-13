"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recipeRoutes = exports.profileRoutes = exports.authRoutes = void 0;
var auth_routes_1 = require("../05_frameworks/myexpress/routes/auth.routes");
Object.defineProperty(exports, "authRoutes", { enumerable: true, get: function () { return __importDefault(auth_routes_1).default; } });
var profile_1 = require("../05_frameworks/myexpress/routes/profile");
Object.defineProperty(exports, "profileRoutes", { enumerable: true, get: function () { return __importDefault(profile_1).default; } });
var recipes_routes_1 = require("../05_frameworks/myexpress/routes/recipes.routes");
Object.defineProperty(exports, "recipeRoutes", { enumerable: true, get: function () { return __importDefault(recipes_routes_1).default; } });
