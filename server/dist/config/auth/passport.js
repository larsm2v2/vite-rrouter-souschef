"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
// Compatibility shim — re-export new framework implementation
var passport_1 = require("../../05_frameworks/auth/passport");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(passport_1).default; } });
