"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Backwards-compatibility shim: re-export the new framework connection
// This keeps existing imports working while the old src/config folder is removed.
const connection_1 = __importDefault(require("../05_frameworks/database/connection"));
exports.default = connection_1.default;
