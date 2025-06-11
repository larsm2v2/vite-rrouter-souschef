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
// tests/database.test.ts
process.env.NODE_ENV = "test";
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../config/schema");
describe("Database Operations", () => {
    let userId;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Initialize database tables
        yield (0, schema_1.initializeDatabase)();
        // Seed the database with a test user
        const result = yield database_1.default.query(`INSERT INTO users (google_sub, display_name, email) 
       VALUES ($1, $2, $3) 
       RETURNING id`, ["test-google-id", "Test User", "test@example.com"]);
        userId = result.rows[0].id; // Store the user ID for later use
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Clean up the database after tests
        yield database_1.default.query("DELETE FROM game_stats");
        yield database_1.default.query("DELETE FROM users");
        yield database_1.default.end(); // Close the connection pool
    }));
    it("should retrieve a user by google_sub", () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield database_1.default.query("SELECT * FROM users WHERE google_sub = $1", ["test-google-id"]);
        const user = result.rows[0];
        expect(user).toBeDefined();
        expect(user.display_name).toBe("Test User");
        expect(user.email).toBe("test@example.com");
    }));
    it("should create a new user", () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield database_1.default.query(`INSERT INTO users (google_sub, display_name, email) 
       VALUES ($1, $2, $3) 
       RETURNING *`, ["new-google-id", "New User", "new@example.com"]);
        const user = result.rows[0];
        expect(user).toBeDefined();
        expect(user.email).toBe("new@example.com");
    }));
    it("should insert and retrieve game stats for a user", () => __awaiter(void 0, void 0, void 0, function* () {
        const buttons_pressed = ["button1", "button2"];
        const saved_maps = ["map1", "map2"];
        // Insert with proper JSON conversion
        const insertResult = yield database_1.default.query(`INSERT INTO game_stats 
       (user_id, current_level, buttons_pressed, saved_maps) 
       VALUES ($1, $2, $3::jsonb, $4::jsonb) 
       RETURNING *`, [userId, 5, JSON.stringify(buttons_pressed), JSON.stringify(saved_maps)]);
        // Query to verify
        const verifyResult = yield database_1.default.query(`SELECT * FROM game_stats WHERE user_id = $1`, [userId]);
        const gameStats = verifyResult.rows[0];
        expect(gameStats.user_id).toBe(userId);
        expect(gameStats.current_level).toBe(5);
        // Compare JSONB data directly
        expect(gameStats.buttons_pressed).toEqual(buttons_pressed);
        expect(gameStats.saved_maps).toEqual(saved_maps);
    }));
});
