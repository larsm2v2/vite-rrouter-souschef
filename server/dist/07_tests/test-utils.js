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
exports.cleanupTestData = cleanupTestData;
exports.toJsonb = toJsonb;
exports.fromJsonb = fromJsonb;
const connection_1 = __importDefault(require("../05_frameworks/database/connection"));
let testUserIds = [];
let poolClient = null;
function createTestUser() {
    return __awaiter(this, void 0, void 0, function* () {
        const googleSub = `test-sub-${Date.now()}`;
        const email = `test-${Date.now()}@example.com`;
        // Get a single client for all operations
        if (!poolClient) {
            poolClient = yield connection_1.default.connect();
        }
        try {
            const result = yield poolClient.query(`INSERT INTO users (google_sub, email, display_name) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, display_name`, [googleSub, email, "Test User"]);
            testUserIds.push(result.rows[0].id);
            return result.rows[0];
        }
        catch (err) {
            console.error("Error creating test user:", err);
            throw err;
        }
    });
}
function cleanupTestData() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Only delete specific test users we've created
            if (testUserIds.length > 0) {
                if (!poolClient) {
                    poolClient = yield connection_1.default.connect();
                }
                yield poolClient.query("BEGIN");
                yield poolClient.query(`DELETE FROM grocery_list WHERE user_id = ANY($1)`, [testUserIds]);
                yield poolClient.query(`DELETE FROM recipes WHERE user_id = ANY($1)`, [
                    testUserIds,
                ]);
                yield poolClient.query(`DELETE FROM users WHERE id = ANY($1)`, [
                    testUserIds,
                ]);
                yield poolClient.query("COMMIT");
                testUserIds = [];
            }
        }
        catch (err) {
            if (poolClient) {
                yield poolClient.query("ROLLBACK");
            }
            console.error("Error cleaning up test data:", err);
        }
    });
}
// Clean up after each test
afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
    yield cleanupTestData();
}));
// Add this to the global afterAll hook
afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
    // Release the client back to the pool
    if (poolClient) {
        poolClient.release();
        poolClient = null;
    }
    // Close the pool connection after all tests
    try {
        yield connection_1.default.end();
        console.log("Pool closed after tests");
    }
    catch (err) {
        console.error("Error closing pool after tests:", err);
    }
}));
function toJsonb(value) {
    return JSON.stringify(value);
}
function fromJsonb(value) {
    return JSON.parse(value);
}
