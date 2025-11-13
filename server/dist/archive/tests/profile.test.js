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
const app_1 = __importDefault(require("../app"));
const test_utils_1 = require("./test-utils");
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../config/schema");
describe("GET /profile", () => {
    let testUser;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, schema_1.initializeDatabase)();
        testUser = yield (0, test_utils_1.createTestUser)();
    }));
    it("should return 401 if not authenticated", () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app_1.default).get("/profile");
        expect(res.status).toBe(401);
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield database_1.default.query("DELETE FROM users WHERE id = $1", [testUser.id]);
    }));
});
