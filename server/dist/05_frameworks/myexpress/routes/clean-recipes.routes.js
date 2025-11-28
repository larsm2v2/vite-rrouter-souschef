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
const express_1 = require("express");
const jwtAuth_1 = require("../jwtAuth");
const connection_1 = __importDefault(require("../../database/connection"));
const client_1 = require("../../cleanRecipe/client");
console.log("📥 Importing clean-recipes.routes");
const router = (0, express_1.Router)();
/**
 * POST /clean-recipes
 * Fetch all recipes and clean them using the clean-recipe microservice
 */
router.post("/", jwtAuth_1.authenticateJWT, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Fetch all recipes from database
        const result = yield connection_1.default.query(`
        SELECT 
          r.*,
          rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings,
          json_agg(DISTINCT jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients)) FILTER (WHERE ri.category IS NOT NULL) AS ingredients,
          json_agg(jsonb_build_object('step_number', inst.step_number, 'instruction', inst.instruction) ORDER BY inst.step_number) FILTER (WHERE inst.step_number IS NOT NULL) AS instructions,
          json_agg(DISTINCT rn.note) FILTER (WHERE rn.note IS NOT NULL) AS notes,
          rnut.nutrition_data
        FROM recipes r
        LEFT JOIN recipe_serving_info rsi ON r.id = rsi.recipe_id
        LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
        LEFT JOIN recipe_instructions inst ON r.id = inst.recipe_id
        LEFT JOIN recipe_notes rn ON r.id = rn.recipe_id
        LEFT JOIN recipe_nutrition rnut ON r.id = rnut.recipe_id
        GROUP BY r.id, rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings, rnut.nutrition_data
        ORDER BY r.created_at DESC
      `);
        // Clean each recipe using the microservice
        const cleanedRecipes = yield Promise.all(result.rows.map((recipe) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const cleaned = yield (0, client_1.cleanRecipe)(recipe);
                // Ensure meal_type is mapped to "meal type" for frontend compatibility
                return Object.assign(Object.assign({}, cleaned), { "meal type": cleaned.mealType ||
                        cleaned["meal type"] ||
                        recipe.meal_type ||
                        "Other", id: ((_a = cleaned.id) === null || _a === void 0 ? void 0 : _a.toString()) || ((_b = recipe.id) === null || _b === void 0 ? void 0 : _b.toString()), "unique id": cleaned.uniqueId || cleaned["unique id"] || recipe.unique_id, "dietary restrictions and designations": cleaned.dietaryRestrictions ||
                        cleaned["dietary restrictions and designations"] ||
                        recipe.dietary_restrictions ||
                        [] });
            }
            catch (error) {
                console.error(`Failed to clean recipe ${recipe.id}:`, error);
                // Return recipe with frontend-compatible format
                return Object.assign(Object.assign({}, recipe), { id: (_c = recipe.id) === null || _c === void 0 ? void 0 : _c.toString(), "unique id": recipe.unique_id, "meal type": recipe.meal_type || "Other", "dietary restrictions and designations": recipe.dietary_restrictions || [] });
            }
        })));
        res.json({ data: cleanedRecipes });
    }
    catch (error) {
        next(error);
    }
}));
exports.default = router;
