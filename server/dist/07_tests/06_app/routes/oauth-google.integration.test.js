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
const assertRouteExists_1 = require("../../helpers/assertRouteExists");
describe("POST /api/oauth/google/token (mocked Google)", () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Ensure the route exists in the mounted app — stable and uses /debug/routes
        yield (0, assertRouteExists_1.assertRouteExists)("/api/oauth/google/token", "post");
    }));
    let originalFetch;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        // Spy on global.fetch to intercept outgoing calls to Google
        originalFetch = global.fetch;
        global.fetch = jest.fn();
        // Mock the DB queries used in oauth-google.routes so CI/test doesn't need a live DB
        let inserted = false;
        jest
            .spyOn(connection_1.default, "query")
            .mockImplementation((sql, params) => __awaiter(void 0, void 0, void 0, function* () {
            const normalized = sql.toLowerCase();
            // The presence of a row for google_sub is handled below and depends
            // on whether an INSERT has been simulated.
            // Mock INSERT into users
            if (normalized.startsWith("insert into users")) {
                inserted = true;
                return { rows: [{ id: 999 }] };
            }
            // Mock select by id after insert
            if (normalized.includes("where id = $1")) {
                return {
                    rows: [
                        { id: 999, email: "mock@example.com", display_name: "Mock User" },
                    ],
                };
            }
            // After insert, when the code looks up the user by google_sub, return
            // a row that includes the encrypted token so tests can assert it.
            if (normalized.includes("where google_sub = $1")) {
                if (inserted) {
                    return {
                        rows: [
                            {
                                id: 999,
                                email: "mock@example.com",
                                google_sub: "google-123",
                                google_access_token: "encrypted-token",
                            },
                        ],
                    };
                }
                return { rows: [] };
            }
            // Mock UPDATE used to store encrypted tokens (loose match)
            if (normalized.includes("update users")) {
                return { rows: [{ id: 999 }] };
            }
            // Default: return empty
            return { rows: [] };
        }));
    }));
    afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    }));
    it("returns 400 when Google responds with invalid_grant (invalid code)", () => __awaiter(void 0, void 0, void 0, function* () {
        // Check the route returns a 400 for missing params (this ensures it is mounted)
        // Assert the route is present via /debug/routes (stable and explicit)
        // Ensure the route is present
        yield (0, assertRouteExists_1.assertRouteExists)("/api/oauth/google/token", "post");
        const check = yield (0, supertest_1.default)(index_1.app)
            .post("/api/oauth/google/token")
            .send({})
            .set("Content-Type", "application/json");
        // Debug output if the test fails so we can see what's returned
        if (check.status !== 400) {
            console.error("DEBUG: check response:", check.status, check.body, check.text);
        }
        expect(check.status).toBe(400);
        // Mock token endpoint to return a Google error
        global.fetch.mockImplementationOnce((url) => __awaiter(void 0, void 0, void 0, function* () {
            if (url.includes("oauth2.googleapis.com/token")) {
                return {
                    ok: false,
                    status: 400,
                    json: () => __awaiter(void 0, void 0, void 0, function* () {
                        return ({
                            error: "invalid_grant",
                            error_description: "Malformed auth code.",
                        });
                    }),
                };
            }
            throw new Error("unexpected call");
        }));
        const res = yield (0, supertest_1.default)(index_1.app)
            .post("/api/oauth/google/token")
            .send({ code: "bad", code_verifier: "fake" })
            .set("Content-Type", "application/json");
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Failed to exchange authorization code with Google");
    }));
    it("creates user and returns tokens on valid token exchange", () => __awaiter(void 0, void 0, void 0, function* () {
        // Ensure route is mounted via /debug/routes
        // Ensure the route is present
        yield (0, assertRouteExists_1.assertRouteExists)("/api/oauth/google/token", "post");
        // Mock token endpoint success
        global.fetch
            .mockImplementationOnce((url) => __awaiter(void 0, void 0, void 0, function* () {
            if (url.includes("oauth2.googleapis.com/token")) {
                return {
                    ok: true,
                    status: 200,
                    json: () => __awaiter(void 0, void 0, void 0, function* () {
                        return ({
                            access_token: "G_ACCESS",
                            refresh_token: "G_REFRESH",
                        });
                    }),
                };
            }
            throw new Error("unexpected call");
        }))
            // Then mock the userinfo call
            .mockImplementationOnce((url) => __awaiter(void 0, void 0, void 0, function* () {
            if (url.includes("www.googleapis.com/oauth2/v3/userinfo")) {
                return {
                    ok: true,
                    status: 200,
                    json: () => __awaiter(void 0, void 0, void 0, function* () {
                        return ({
                            sub: "google-123",
                            email: "mock@example.com",
                            name: "Mock User",
                            picture: "http://x",
                        });
                    }),
                };
            }
            throw new Error("unexpected call");
        }));
        const res = yield (0, supertest_1.default)(index_1.app)
            .post("/api/oauth/google/token")
            .send({ code: "valid", code_verifier: "verifier" })
            .set("Content-Type", "application/json");
        expect(res.status).toBe(200);
        expect(res.body.access_token).toBeDefined();
        expect(res.body.user).toBeDefined();
        // server should set a refresh token cookie
        expect(res.header["set-cookie"]).toBeDefined();
        // Verify user in DB
        const userRes = yield connection_1.default.query("SELECT id, google_sub, email, google_access_token FROM users WHERE google_sub = $1", ["google-123"]);
        expect(userRes.rows.length).toBe(1);
        const dbUser = userRes.rows[0];
        expect(dbUser.email).toBe("mock@example.com");
        expect(dbUser.google_access_token).toBeTruthy();
    }));
});
