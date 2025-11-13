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
process.env.NODE_ENV = "test";
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../config/schema");
describe("Database Operations", () => {
    let userId;
    let recipeId;
    let googleSub;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // Initialize database tables
            yield (0, schema_1.initializeDatabase)();
            // Generate unique values for this test run
            googleSub = `test-google-id-${Date.now()}`;
            const email = `test-${Date.now()}@example.com`;
            const uniqueId = Date.now(); // Use timestamp for uniqueness
            const slug = `test-recipe-${Date.now()}`;
            console.log("Creating test user...");
            // Insert a test user first
            const userResult = yield database_1.default.query(`INSERT INTO users (google_sub, display_name, email)
         VALUES ($1, $2, $3)
         RETURNING id`, [googleSub, "Test User", email]);
            userId = userResult.rows[0].id;
            console.log(`Created test user with ID: ${userId}`);
            console.log("Creating test recipe...");
            // Insert a test recipe with the user_id
            const recipeResult = yield database_1.default.query(`INSERT INTO recipes (user_id, unique_id, name, slug, cuisine, meal_type, dietary_restrictions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`, [
                userId,
                uniqueId,
                "Test Recipe",
                slug,
                "Italian",
                "Dinner",
                "{Vegetarian}",
            ]);
            recipeId = recipeResult.rows[0].id;
            console.log(`Created test recipe with ID: ${recipeId}`);
            console.log("Creating grocery list item...");
            // Insert a test grocery list item with both IDs
            yield database_1.default.query(`INSERT INTO grocery_list (user_id, recipe_id, item_name, quantity, unit)
         VALUES ($1, $2, $3, $4, $5)`, [userId, recipeId, "Tomatoes", 2, "kg"]);
            console.log("Test setup completed successfully");
        }
        catch (err) {
            console.error("Test setup failed:", err);
            throw err;
        }
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            console.log("Cleaning up test data...");
            // Delete in correct order to respect foreign key constraints
            yield database_1.default.query("DELETE FROM grocery_list WHERE user_id = $1", [userId]);
            yield database_1.default.query("DELETE FROM recipes WHERE user_id = $1", [userId]);
            yield database_1.default.query("DELETE FROM users WHERE id = $1", [userId]);
            console.log("Test data cleaned up successfully");
        }
        catch (err) {
            console.error("Cleanup error:", err);
        }
    }));
    it("should retrieve a user by google_sub", () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield database_1.default.query("SELECT * FROM users WHERE google_sub = $1", [googleSub]);
        const user = result.rows[0];
        expect(user).toBeDefined();
        expect(user.display_name).toBe("Test User");
    }));
    it("should create a new user", () => __awaiter(void 0, void 0, void 0, function* () {
        const newGoogleSub = `new-google-id-${Date.now()}`;
        const newEmail = `new-${Date.now()}@example.com`;
        const result = yield database_1.default.query(`INSERT INTO users (google_sub, display_name, email)
       VALUES ($1, $2, $3)
       RETURNING *`, [newGoogleSub, "New User", newEmail]);
        const user = result.rows[0];
        expect(user).toBeDefined();
        expect(user.email).toBe(newEmail);
        // Clean up this specific test user
        yield database_1.default.query("DELETE FROM users WHERE google_sub = $1", [newGoogleSub]);
    }));
    it("should associate recipes with users", () => __awaiter(void 0, void 0, void 0, function* () {
        const groceryResult = yield database_1.default.query(`INSERT INTO grocery_list (user_id, recipe_id, item_name, quantity)
       VALUES ($1, $2, $3, $4)
       RETURNING id`, [userId, recipeId, "Test Item", 2]);
        expect(groceryResult.rows[0].id).toBeDefined();
    }));
    it("should retrieve recipes for a user", () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield database_1.default.query("SELECT * FROM recipes WHERE user_id = $1", [userId]);
        const recipes = result.rows;
        expect(recipes).toBeDefined();
        expect(recipes.length).toBeGreaterThan(0);
        expect(recipes[0].name).toBe("Test Recipe");
    }));
    it("should retrieve grocery list for a user", () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield database_1.default.query("SELECT * FROM grocery_list WHERE user_id = $1", [userId]);
        const groceryList = result.rows;
        expect(groceryList).toBeDefined();
        expect(groceryList.length).toBeGreaterThan(0);
        expect(groceryList[0].item_name).toBe("Tomatoes");
    }));
});
