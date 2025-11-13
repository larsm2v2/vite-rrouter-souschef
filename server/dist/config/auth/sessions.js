"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionConfig = void 0;
// Backwards-compatibility shim — re-export sessionConfig from the framework auth folder
var sessions_1 = require("../../05_frameworks/auth/sessions");
Object.defineProperty(exports, "sessionConfig", { enumerable: true, get: function () { return sessions_1.sessionConfig; } });
