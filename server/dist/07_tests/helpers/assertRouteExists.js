"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertRouteExists = assertRouteExists;
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../../05_frameworks/index");
/**
 * Ensures that a route is mounted on the app.
 * Throws an error if the route is missing.
 */
function assertRouteExists(path_1) {
    return __awaiter(this, arguments, void 0, function* (path, method = "post") {
        var _a, _b;
        const debug = yield (0, supertest_1.default)(index_1.app).get("/debug/routes");
        let routes = null;
        if (debug.status === 200 && Array.isArray(debug.body.routes)) {
            routes = debug.body.routes;
        }
        else {
            // Fallback: if the test harness doesn't mount the server debug endpoints,
            // introspect the app._router stack directly (this mirrors /debug/routes).
            const stack = ((_a = index_1.app._router) === null || _a === void 0 ? void 0 : _a.stack) || [];
            const built = [];
            function walk(stack, basePath = "") {
                stack.forEach((layer) => {
                    var _a;
                    try {
                        if (layer.route) {
                            built.push({
                                path: basePath + (layer.route.path || ""),
                                methods: Object.keys(layer.route.methods || {}),
                            });
                        }
                        else if (layer.name === "router" &&
                            layer.handle &&
                            layer.handle.stack) {
                            const prefix = ((_a = layer.regexp) === null || _a === void 0 ? void 0 : _a.source)
                                ? layer.regexp.source
                                    .replace("\\/?", "")
                                    .replace("(?=\\/|$)", "")
                                    .replace(/\\/g, "")
                                : "";
                            const cleaned = prefix.replace(/\^|\$|\(|\)|\?=|\\/g, "");
                            const newBase = (basePath + cleaned).replace(/\/\//g, "/");
                            walk(layer.handle.stack, newBase);
                        }
                    }
                    catch (ignore) {
                        // Ignore odd / non-standard layers
                    }
                });
            }
            walk(stack);
            routes = built;
        }
        const normalizedMethod = (method || "post").toLowerCase();
        const found = (routes || []).some((r) => {
            const hasPath = r.path === path;
            const methods = (r.methods || []).map((m) => m.toLowerCase());
            const hasMethod = methods.includes(normalizedMethod);
            return hasPath && hasMethod;
        });
        if (!found) {
            // Provide helpful debugging information in the error
            const available = (routes || [])
                .map((r) => `${(r.methods || []).join(",")} ${r.path}`)
                .slice(0, 200)
                .join(" | ");
            try {
                const modules = yield (0, supertest_1.default)(index_1.app).get("/debug/imported-modules");
                const imported = ((_b = modules.body) === null || _b === void 0 ? void 0 : _b.modules) || [];
                const importedMsg = imported
                    .map((m) => m.split("/routes/").pop() || m)
                    .slice(0, 50)
                    .join(", ");
                throw new Error(`Expected route ${method.toUpperCase()} ${path} to exist, but it was not found in /debug/routes. Available routes: ${available}\nImported route modules: ${importedMsg}`);
            }
            catch (err) {
                throw new Error(`Expected route ${method.toUpperCase()} ${path} to exist, but it was not found in /debug/routes. Available routes: ${available}`);
            }
            throw new Error(`Expected route ${method.toUpperCase()} ${path} to exist, but it was not found in /debug/routes. Available routes: ${available}`);
        }
    });
}
