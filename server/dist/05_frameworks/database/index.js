"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateRecipeTables = exports.pool = void 0;
var connection_1 = require("./connection");
Object.defineProperty(exports, "pool", { enumerable: true, get: function () { return connection_1.pool; } });
var migrations_1 = require("./migrations/migrations");
Object.defineProperty(exports, "migrateRecipeTables", { enumerable: true, get: function () { return migrations_1.migrateRecipeTables; } });
