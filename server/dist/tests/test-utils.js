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
exports.createTestUser = createTestUser;
exports.createCompleteTestUser = createCompleteTestUser;
exports.cleanupTestData = cleanupTestData;
exports.toJsonb = toJsonb;
exports.fromJsonb = fromJsonb;
// src/tests/test-utils.ts
const database_1 = __importDefault(require("../config/database"));
function createTestUser() {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield database_1.default.query(`INSERT INTO users (google_sub, email, display_name) 
     VALUES ($1, $2, $3) 
     RETURNING id, email, display_name`, [`test-sub-${Date.now()}`, `test-${Date.now()}@example.com`, "Test User"]);
        return result.rows[0];
    });
}
function createCompleteTestUser() {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield createTestUser();
        yield database_1.default.query(`INSERT INTO game_stats (user_id) VALUES ($1)`, [user.id]);
        return user;
    });
}
function cleanupTestData() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield database_1.default.query("DELETE FROM game_stats");
            yield database_1.default.query("DELETE FROM users");
        }
        catch (err) {
            console.error('Error cleaning up test data:', err);
        }
    });
}
// Clean up after each test
afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
    yield cleanupTestData();
}));
// Clean up after all tests
afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
    yield database_1.default.end();
}));
function toJsonb(value) {
    return JSON.stringify(value);
}
function fromJsonb(value) {
    return JSON.parse(value);
}
