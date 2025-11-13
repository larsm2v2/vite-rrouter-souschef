"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authLimiter = void 0;
// Compatibility shim: re-export authLimiter from framework middleware
var middleware_1 = require("../05_frameworks/myexpress/middleware");
Object.defineProperty(exports, "authLimiter", { enumerable: true, get: function () { return middleware_1.authLimiter; } });
