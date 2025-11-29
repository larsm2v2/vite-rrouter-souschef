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
const express_1 = __importDefault(require("express"));
const generative_ai_1 = require("@google/generative-ai");
const connection_1 = __importDefault(require("../../database/connection"));
const jwtAuth_1 = require("../jwtAuth");
console.log("📥 Importing recipes.routes");
const router = express_1.default.Router();
// Initialize Google Generative AI
const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.warn("WARNING: API_KEY environment variable not found!");
}
const genAI = apiKey ? new generative_ai_1.GoogleGenerativeAI(apiKey) : null;
// Get all recipes
router.get("/", jwtAuth_1.authenticateJWT, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield connection_1.default.query(`
      SELECT
        r.*,
        rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings,
        (
          SELECT json_agg(jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients))
          FROM recipe_ingredients ri
          WHERE ri.recipe_id = r.id
        ) AS ingredients,
        (
          SELECT json_agg(jsonb_build_object('step_number', inst.step_number, 'instruction', inst.instruction) ORDER BY inst.step_number)
          FROM recipe_instructions inst
          WHERE inst.recipe_id = r.id
        ) AS instructions,
        (
          SELECT json_agg(rn.note)
          FROM recipe_notes rn
          WHERE rn.recipe_id = r.id
        ) AS notes,
        rnut.nutrition_data
      FROM recipes r
      LEFT JOIN recipe_serving_info rsi ON r.id = rsi.recipe_id
      LEFT JOIN recipe_nutrition rnut ON r.id = rnut.recipe_id
      ORDER BY r.created_at DESC
    `);
        // Return snake_case format matching frontend interfaces
        const transformedRecipes = result.rows.map((row) => {
            // Transform ingredients from array to object with category keys
            const ingredientsObj = {};
            if (row.ingredients && Array.isArray(row.ingredients)) {
                row.ingredients.forEach((item) => {
                    if (item.category && item.ingredients) {
                        ingredientsObj[item.category] = item.ingredients;
                    }
                });
            }
            return {
                id: row.id.toString(),
                name: row.name || "",
                unique_id: row.unique_id,
                cuisine: row.cuisine || "",
                meal_type: row.meal_type || "",
                dietary_restrictions: row.dietary_restrictions || [],
                serving_info: {
                    prep_time: row.prep_time,
                    cook_time: row.cook_time,
                    total_time: row.total_time,
                    servings: row.servings,
                },
                ingredients: ingredientsObj,
                instructions: (row.instructions || []).map((inst) => ({
                    number: inst.step_number,
                    text: inst.instruction,
                })),
                notes: row.notes || [],
                nutrition: row.nutrition_data || {},
            };
        });
        res.json(transformedRecipes);
    }
    catch (error) {
        next(error);
    }
}));
// Get a specific recipe by ID
router.get("/:id", jwtAuth_1.authenticateJWT, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield connection_1.default.query(`
      SELECT
        r.*,
        rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings,
        (
          SELECT json_agg(jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients))
          FROM recipe_ingredients ri
          WHERE ri.recipe_id = r.id
        ) AS ingredients,
        (
          SELECT json_agg(jsonb_build_object('step_number', inst.step_number, 'instruction', inst.instruction) ORDER BY inst.step_number)
          FROM recipe_instructions inst
          WHERE inst.recipe_id = r.id
        ) AS instructions,
        (
          SELECT json_agg(rn.note)
          FROM recipe_notes rn
          WHERE rn.recipe_id = r.id
        ) AS notes,
        rnut.nutrition_data
      FROM recipes r
      LEFT JOIN recipe_serving_info rsi ON r.id = rsi.recipe_id
      LEFT JOIN recipe_nutrition rnut ON r.id = rnut.recipe_id
      WHERE r.id = $1
    `, [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Recipe not found" });
        }
        const row = result.rows[0];
        // Transform ingredients from array to object with category keys
        const ingredientsObj = {};
        if (row.ingredients && Array.isArray(row.ingredients)) {
            row.ingredients.forEach((item) => {
                if (item.category && item.ingredients) {
                    ingredientsObj[item.category] = item.ingredients;
                }
            });
        }
        const transformedRecipe = {
            id: row.id.toString(),
            name: row.name || "",
            unique_id: row.unique_id,
            cuisine: row.cuisine || "",
            meal_type: row.meal_type || "",
            dietary_restrictions: row.dietary_restrictions || [],
            serving_info: {
                prep_time: row.prep_time,
                cook_time: row.cook_time,
                total_time: row.total_time,
                servings: row.servings,
            },
            ingredients: ingredientsObj,
            instructions: (row.instructions || []).map((inst) => ({
                number: inst.step_number,
                text: inst.instruction,
            })),
            notes: row.notes || [],
            nutrition: row.nutrition_data || {},
        };
        res.json(transformedRecipe);
    }
    catch (error) {
        next(error);
    }
}));
// Generate a recipe with Gemini AI
router.post("/generate", jwtAuth_1.authenticateJWT, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!genAI)
            return res.status(503).json({ error: "AI service not available" });
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const chat = model.startChat({
            history: req.body.history || [],
            generationConfig: {
                temperature: 0.3,
                topP: 0.2,
            },
        });
        const msg = req.body.message;
        const result = yield chat.sendMessageStream(msg);
        const response = yield result.response;
        const text = response.text();
        res.send(text);
    }
    catch (error) {
        next(error);
    }
}));
// Save a recipe to the database (delegate to controller)
require("../../../04_factories/di");
const tsyringe_1 = require("tsyringe");
const RecipeController_1 = require("../../../03_adapters/controllers/RecipeController");
const recipeController = tsyringe_1.container.resolve(RecipeController_1.RecipeController);
router.post("/", jwtAuth_1.authenticateJWT, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield recipeController.create(req, res);
    }
    catch (err) {
        next(err);
    }
}));
exports.default = router;
