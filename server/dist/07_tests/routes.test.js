"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
require("reflect-metadata");
require("../04_factories/di"); // Initialize DI container
const index_1 = __importDefault(require("../05_frameworks/myexpress/routes/index"));
const auth_routes_1 = __importDefault(require("../05_frameworks/myexpress/routes/auth.routes"));
const oauth_google_routes_1 = __importDefault(require("../05_frameworks/myexpress/routes/oauth-google.routes"));
const profile_1 = __importDefault(require("../05_frameworks/myexpress/routes/profile"));
const recipes_routes_1 = __importDefault(require("../05_frameworks/myexpress/routes/recipes.routes"));
const grocery_routes_1 = __importDefault(require("../05_frameworks/myexpress/routes/grocery.routes"));
const profileFeatures_routes_1 = __importDefault(require("../05_frameworks/myexpress/routes/profileFeatures.routes"));
describe("Routes Module Tests", () => {
    describe("Individual Route Modules", () => {
        it("should import auth.routes successfully", () => {
            var _a;
            expect(auth_routes_1.default).toBeDefined();
            expect(typeof auth_routes_1.default).toBe("function");
            expect(auth_routes_1.default.stack).toBeDefined();
            console.log("auth.routes stack length:", ((_a = auth_routes_1.default.stack) === null || _a === void 0 ? void 0 : _a.length) || 0);
        });
        it("should import oauth-google.routes successfully", () => {
            var _a;
            expect(oauth_google_routes_1.default).toBeDefined();
            expect(typeof oauth_google_routes_1.default).toBe("function");
            expect(oauth_google_routes_1.default.stack).toBeDefined();
            console.log("oauth-google.routes stack length:", ((_a = oauth_google_routes_1.default.stack) === null || _a === void 0 ? void 0 : _a.length) || 0);
        });
        it("should import profile routes successfully", () => {
            var _a;
            expect(profile_1.default).toBeDefined();
            expect(typeof profile_1.default).toBe("function");
            expect(profile_1.default.stack).toBeDefined();
            console.log("profile routes stack length:", ((_a = profile_1.default.stack) === null || _a === void 0 ? void 0 : _a.length) || 0);
        });
        it("should import recipes.routes successfully", () => {
            var _a;
            expect(recipes_routes_1.default).toBeDefined();
            expect(typeof recipes_routes_1.default).toBe("function");
            expect(recipes_routes_1.default.stack).toBeDefined();
            console.log("recipes.routes stack length:", ((_a = recipes_routes_1.default.stack) === null || _a === void 0 ? void 0 : _a.length) || 0);
        });
        it("should import grocery.routes successfully", () => {
            var _a;
            expect(grocery_routes_1.default).toBeDefined();
            expect(typeof grocery_routes_1.default).toBe("function");
            expect(grocery_routes_1.default.stack).toBeDefined();
            console.log("grocery.routes stack length:", ((_a = grocery_routes_1.default.stack) === null || _a === void 0 ? void 0 : _a.length) || 0);
        });
        it("should import profileFeatures.routes successfully", () => {
            var _a;
            expect(profileFeatures_routes_1.default).toBeDefined();
            expect(typeof profileFeatures_routes_1.default).toBe("function");
            expect(profileFeatures_routes_1.default.stack).toBeDefined();
            console.log("profileFeatures.routes stack length:", ((_a = profileFeatures_routes_1.default.stack) === null || _a === void 0 ? void 0 : _a.length) || 0);
        });
    });
    describe("Combined Routes Module", () => {
        it("should import routes index successfully", () => {
            expect(index_1.default).toBeDefined();
            expect(typeof index_1.default).toBe("function");
            expect(index_1.default.stack).toBeDefined();
        });
        it("should have 6 route mounts in the routes stack", () => {
            var _a, _b;
            console.log("\n=== ROUTES STACK ANALYSIS ===");
            console.log("Total routes.stack length:", ((_a = index_1.default.stack) === null || _a === void 0 ? void 0 : _a.length) || 0);
            console.log("\nRoutes stack details:");
            (_b = index_1.default.stack) === null || _b === void 0 ? void 0 : _b.forEach((layer, index) => {
                var _a, _b, _c;
                console.log(`\n[${index}] Layer:`, {
                    name: layer.name,
                    regexp: ((_a = layer.regexp) === null || _a === void 0 ? void 0 : _a.source) || "no regexp",
                    path: ((_b = layer.route) === null || _b === void 0 ? void 0 : _b.path) || "no direct path",
                    handle: typeof layer.handle,
                    keys: layer.keys,
                });
                // If it's a router, show its routes
                if (layer.name === "router" && ((_c = layer.handle) === null || _c === void 0 ? void 0 : _c.stack)) {
                    console.log(`  Router has ${layer.handle.stack.length} routes:`);
                    layer.handle.stack.forEach((route, i) => {
                        var _a, _b;
                        console.log(`    [${i}]`, {
                            path: ((_a = route.route) === null || _a === void 0 ? void 0 : _a.path) || route.path || "unknown",
                            methods: ((_b = route.route) === null || _b === void 0 ? void 0 : _b.methods) || route.methods || "unknown",
                        });
                    });
                }
            });
            // Expected: 6 router middlewares (oauth, auth, recipes, grocery, profile, profileFeatures)
            expect(index_1.default.stack.length).toBe(6);
        });
        it("should mount /api/oauth routes first", () => {
            var _a, _b, _c;
            const oauthLayer = (_a = index_1.default.stack) === null || _a === void 0 ? void 0 : _a[0];
            expect(oauthLayer).toBeDefined();
            expect(oauthLayer.name).toBe("router");
            // Check the regexp matches /api/oauth
            expect((_b = oauthLayer.regexp) === null || _b === void 0 ? void 0 : _b.source).toContain("api");
            expect((_c = oauthLayer.regexp) === null || _c === void 0 ? void 0 : _c.source).toContain("oauth");
        });
        it("should mount /auth routes second", () => {
            var _a, _b;
            const authLayer = (_a = index_1.default.stack) === null || _a === void 0 ? void 0 : _a[1];
            expect(authLayer).toBeDefined();
            expect(authLayer.name).toBe("router");
            expect((_b = authLayer.regexp) === null || _b === void 0 ? void 0 : _b.source).toContain("auth");
        });
    });
    describe("Route Registration Test", () => {
        it("should register routes on an Express app correctly", () => {
            var _a, _b, _c, _d, _e, _f;
            const testApp = (0, express_1.default)();
            testApp.use(index_1.default);
            console.log("\n=== EXPRESS APP STACK ANALYSIS ===");
            console.log("App middleware stack length:", ((_b = (_a = testApp._router) === null || _a === void 0 ? void 0 : _a.stack) === null || _b === void 0 ? void 0 : _b.length) || 0);
            (_d = (_c = testApp._router) === null || _c === void 0 ? void 0 : _c.stack) === null || _d === void 0 ? void 0 : _d.forEach((layer, index) => {
                var _a, _b, _c;
                if (layer.name === "router") {
                    console.log(`\n[${index}] Router middleware:`, {
                        regexp: (_a = layer.regexp) === null || _a === void 0 ? void 0 : _a.source,
                        routeCount: ((_c = (_b = layer.handle) === null || _b === void 0 ? void 0 : _b.stack) === null || _c === void 0 ? void 0 : _c.length) || 0,
                    });
                }
            });
            // The app should have the routes mounted
            const routersInApp = (_f = (_e = testApp._router) === null || _e === void 0 ? void 0 : _e.stack) === null || _f === void 0 ? void 0 : _f.filter((layer) => layer.name === "router");
            console.log("\nTotal routers in app:", (routersInApp === null || routersInApp === void 0 ? void 0 : routersInApp.length) || 0);
            expect(routersInApp === null || routersInApp === void 0 ? void 0 : routersInApp.length).toBeGreaterThan(0);
        });
    });
    describe("OAuth Google Routes Specific Tests", () => {
        it("should have POST /google/token route in oauth-google.routes", () => {
            var _a, _b, _c;
            console.log("\n=== OAUTH GOOGLE ROUTES ANALYSIS ===");
            console.log("oauth-google routes stack:", oauth_google_routes_1.default.stack);
            const postRoute = (_a = oauth_google_routes_1.default.stack) === null || _a === void 0 ? void 0 : _a.find((layer) => { var _a; return ((_a = layer.route) === null || _a === void 0 ? void 0 : _a.path) === "/google/token"; });
            expect(postRoute).toBeDefined();
            expect((_c = (_b = postRoute === null || postRoute === void 0 ? void 0 : postRoute.route) === null || _b === void 0 ? void 0 : _b.methods) === null || _c === void 0 ? void 0 : _c.post).toBe(true);
        });
        it("should mount oauth routes at /api/oauth in main routes", () => {
            var _a, _b, _c, _d, _e, _f;
            const oauthLayer = (_a = index_1.default.stack) === null || _a === void 0 ? void 0 : _a[0];
            console.log("\n=== OAUTH MOUNTING ANALYSIS ===");
            console.log("First layer in routes.stack:", {
                name: oauthLayer === null || oauthLayer === void 0 ? void 0 : oauthLayer.name,
                regexp: (_b = oauthLayer === null || oauthLayer === void 0 ? void 0 : oauthLayer.regexp) === null || _b === void 0 ? void 0 : _b.source,
                handle: typeof (oauthLayer === null || oauthLayer === void 0 ? void 0 : oauthLayer.handle),
                handleStack: (_d = (_c = oauthLayer === null || oauthLayer === void 0 ? void 0 : oauthLayer.handle) === null || _c === void 0 ? void 0 : _c.stack) === null || _d === void 0 ? void 0 : _d.length,
            });
            // Verify it's a router
            expect(oauthLayer === null || oauthLayer === void 0 ? void 0 : oauthLayer.name).toBe("router");
            // Verify it has routes inside
            expect((_f = (_e = oauthLayer === null || oauthLayer === void 0 ? void 0 : oauthLayer.handle) === null || _e === void 0 ? void 0 : _e.stack) === null || _f === void 0 ? void 0 : _f.length).toBeGreaterThan(0);
        });
    });
});
