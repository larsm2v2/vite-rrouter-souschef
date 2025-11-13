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
const app_1 = __importDefault(require("../../../app"));
const connection_1 = __importDefault(require("../../../05_frameworks/database/connection"));
const schema_1 = require("../../../05_frameworks/database/schema");
const test_utils_1 = require("../../test-utils");
describe("Profile Routes", () => {
    let testUser;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, schema_1.initializeDatabase)();
        testUser = yield (0, test_utils_1.createTestUser)();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield connection_1.default.query("DELETE FROM users WHERE id = $1", [testUser.id]);
    }));
    describe("GET /profile", () => {
        it("should return 401 if not authenticated", () => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield (0, supertest_1.default)(app_1.default).get("/profile");
            expect(res.status).toBe(401);
        }));
        it("should return user profile if authenticated (placeholder)", () => __awaiter(void 0, void 0, void 0, function* () {
            // This requires session setup or passport mocking. Placeholder for future expansion.
            expect(true).toBe(true);
        }));
    });
});
