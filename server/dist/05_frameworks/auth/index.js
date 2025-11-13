"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionConfig = exports.passport = void 0;
var passport_1 = require("./passport");
Object.defineProperty(exports, "passport", { enumerable: true, get: function () { return __importDefault(passport_1).default; } });
var sessions_1 = require("./sessions");
Object.defineProperty(exports, "sessionConfig", { enumerable: true, get: function () { return sessions_1.sessionConfig; } });
