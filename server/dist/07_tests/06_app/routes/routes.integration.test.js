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
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../../05_frameworks/index");
describe("Route discovery and endpoints (integration)", () => {
    it("should discover oauth router and token route in routes module", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        // Inspect the routes module directly to ensure the oauth router is present
        // and contains the token route. This test doesn't rely on HTTP or Cloud Run.
        const oauthIdx = require("../../../05_frameworks/myexpress/routes/index").default;
        const oauthLayer = (_a = oauthIdx.stack) === null || _a === void 0 ? void 0 : _a.find((l) => { var _a, _b; return l.name === "router" && ((_b = (_a = l.regexp) === null || _a === void 0 ? void 0 : _a.source) === null || _b === void 0 ? void 0 : _b.includes("oauth")); });
        expect(oauthLayer).toBeDefined();
        const tokenLayer = (_c = (_b = oauthLayer === null || oauthLayer === void 0 ? void 0 : oauthLayer.handle) === null || _b === void 0 ? void 0 : _b.stack) === null || _c === void 0 ? void 0 : _c.find((l) => { var _a; return ((_a = l.route) === null || _a === void 0 ? void 0 : _a.path) === "/google/token"; });
        expect(tokenLayer).toBeDefined();
    }));
    it("POST /api/oauth/google/token exists (should not return 404)", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        // Check at the router level to avoid testing external Google integration
        const routesTopLayer = (_b = (_a = index_1.app._router) === null || _a === void 0 ? void 0 : _a.stack) === null || _b === void 0 ? void 0 : _b.find((l) => { var _a; return l.name === "router" && ((_a = l.handle) === null || _a === void 0 ? void 0 : _a.stack); });
        const oauthRouterLayer = (_d = (_c = routesTopLayer === null || routesTopLayer === void 0 ? void 0 : routesTopLayer.handle) === null || _c === void 0 ? void 0 : _c.stack) === null || _d === void 0 ? void 0 : _d.find((l) => { var _a; return l.name === "router" && (((_a = l.regexp) === null || _a === void 0 ? void 0 : _a.source) || "").includes("oauth"); });
        expect(oauthRouterLayer).toBeDefined();
        const tokenLayer = (_f = (_e = oauthRouterLayer === null || oauthRouterLayer === void 0 ? void 0 : oauthRouterLayer.handle) === null || _e === void 0 ? void 0 : _e.stack) === null || _f === void 0 ? void 0 : _f.find((l) => { var _a; return ((_a = l.route) === null || _a === void 0 ? void 0 : _a.path) === "/google/token"; });
        expect(tokenLayer).toBeDefined();
        expect((_h = (_g = tokenLayer === null || tokenLayer === void 0 ? void 0 : tokenLayer.route) === null || _g === void 0 ? void 0 : _g.methods) === null || _h === void 0 ? void 0 : _h.post).toBeTruthy();
    }));
});
