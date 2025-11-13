"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = void 0;
// Compatibility shim for schema — forward to new framework schema implementation
const schema_1 = require("../05_frameworks/database/schema");
Object.defineProperty(exports, "initializeDatabase", { enumerable: true, get: function () { return schema_1.initializeDatabase; } });
exports.default = schema_1.initializeDatabase;
