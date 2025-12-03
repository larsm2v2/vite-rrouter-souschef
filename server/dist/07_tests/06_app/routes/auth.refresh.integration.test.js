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
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../../../05_frameworks/index");
const connection_1 = __importDefault(require("../../../05_frameworks/database/connection"));
describe("POST /auth/refresh", () => {
    const testEmail = `refresh-test-${Date.now()}@example.com`;
    const testPassword = "P@ssw0rd!";
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Cleanup any created user
        yield connection_1.default.query("DELETE FROM users WHERE email = $1", [testEmail]);
        yield connection_1.default.query("DELETE FROM refresh_tokens WHERE user_id = (SELECT id FROM users WHERE email = $1)", [testEmail]);
    }));
    it("rotates refresh token and returns new access token", () => __awaiter(void 0, void 0, void 0, function* () {
        // Register a new user which sets refreshToken cookie
        const registerRes = yield (0, supertest_1.default)(index_1.app)
            .post("/api/auth/register")
            .send({
            email: testEmail,
            password: testPassword,
            display_name: "Refresh Tester",
        })
            .set("Content-Type", "application/json");
        expect(registerRes.status).toBe(201);
        expect(registerRes.header["set-cookie"]).toBeDefined();
        // Extract cookie header - can be string or string[] depending on supertest
        const setCookieHeader = registerRes.header["set-cookie"];
        const setCookieArray = Array.isArray(setCookieHeader)
            ? setCookieHeader
            : [setCookieHeader].filter(Boolean);
        const cookieHeader = setCookieArray.find((c) => c.startsWith("refreshToken="));
        expect(cookieHeader).toBeDefined();
        // Send refresh with cookie
        const refreshRes = yield (0, supertest_1.default)(index_1.app)
            .post("/api/auth/refresh")
            .set("Cookie", cookieHeader)
            .send({});
        expect(refreshRes.status).toBe(200);
        expect(refreshRes.body.accessToken).toBeDefined();
    }));
});
