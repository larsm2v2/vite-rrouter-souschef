"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.test = exports.routes = exports.app = void 0;
var app_1 = require("./app");
Object.defineProperty(exports, "app", { enumerable: true, get: function () { return __importDefault(app_1).default; } });
// Import the folder index explicitly to avoid accidental import of ./routes.ts
// which exists for legacy usage. This ensures the main routes in
// `./routes/index.ts` are used in production.
var index_1 = require("./routes/index");
Object.defineProperty(exports, "routes", { enumerable: true, get: function () { return __importDefault(index_1).default; } });
__exportStar(require("./middleware"), exports);
exports.test = "Express module loaded!";
