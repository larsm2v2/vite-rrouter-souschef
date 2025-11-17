"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDevelopment = exports.isProduction = exports.isTest = void 0;
exports.isTest = process.env.NODE_ENV === "test";
exports.isProduction = process.env.NODE_ENV === "production";
exports.isDevelopment = !exports.isTest && !exports.isProduction;
exports.default = {
    isTest: exports.isTest,
    isProduction: exports.isProduction,
    isDevelopment: exports.isDevelopment,
};
