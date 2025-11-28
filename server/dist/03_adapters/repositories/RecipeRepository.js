"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
exports.RecipeRepository = void 0;
const connection_1 = __importDefault(require("../../05_frameworks/database/connection"));
const tsyringe_1 = require("tsyringe");
let RecipeRepository = class RecipeRepository {
    create(recipe) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield connection_1.default.connect();
            try {
                yield client.query("BEGIN");
                // Insert main recipe record
                const recipeResult = yield client.query(`INSERT INTO recipes (user_id, unique_id, name, slug, cuisine, meal_type, dietary_restrictions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`, [
                    recipe.userId,
                    recipe.uniqueId,
                    recipe.name,
                    recipe.slug,
                    recipe.cuisine,
                    recipe.mealType,
                    recipe.dietaryRestrictions,
                ]);
                const savedRecipe = recipeResult.rows[0];
                const recipeId = savedRecipe.id;
                // Insert serving info if provided
                if (recipe.servingInfo) {
                    yield client.query(`INSERT INTO recipe_serving_info (recipe_id, prep_time, cook_time, total_time, servings)
           VALUES ($1, $2, $3, $4, $5)`, [
                        recipeId,
                        recipe.servingInfo.prepTime,
                        recipe.servingInfo.cookTime,
                        recipe.servingInfo.totalTime,
                        recipe.servingInfo.servings,
                    ]);
                }
                // Insert ingredients if provided
                if (recipe.ingredients && typeof recipe.ingredients === "object") {
                    for (const [category, items] of Object.entries(recipe.ingredients)) {
                        if (Array.isArray(items) && items.length > 0) {
                            yield client.query(`INSERT INTO recipe_ingredients (recipe_id, category, ingredients)
               VALUES ($1, $2, $3)`, [recipeId, category, JSON.stringify(items)]);
                        }
                    }
                }
                // Insert instructions if provided
                if (recipe.instructions && Array.isArray(recipe.instructions)) {
                    for (const instruction of recipe.instructions) {
                        yield client.query(`INSERT INTO recipe_instructions (recipe_id, step_number, instruction)
             VALUES ($1, $2, $3)`, [
                            recipeId,
                            instruction.number || instruction.stepNumber,
                            instruction.text || instruction.instruction,
                        ]);
                    }
                }
                // Insert notes if provided
                if (recipe.notes && Array.isArray(recipe.notes)) {
                    for (const note of recipe.notes) {
                        yield client.query(`INSERT INTO recipe_notes (recipe_id, note)
             VALUES ($1, $2)`, [recipeId, note]);
                    }
                }
                // Insert images if provided (from OCR upload)
                if (recipe.images && Array.isArray(recipe.images)) {
                    for (const image of recipe.images) {
                        yield client.query(`INSERT INTO recipe_images (recipe_id, image_url, is_primary)
             VALUES ($1, $2, $3)`, [
                            recipeId,
                            image.imageUrl || image.image_url,
                            image.isPrimary || false,
                        ]);
                    }
                }
                yield client.query("COMMIT");
                return savedRecipe;
            }
            catch (error) {
                yield client.query("ROLLBACK");
                throw error;
            }
            finally {
                client.release();
            }
        });
    }
    update(recipeId, recipeData) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield connection_1.default.query(`UPDATE recipes SET name = $2, slug = $3, cuisine = $4, meal_type = $5, dietary_restrictions = $6
       WHERE id = $1 RETURNING *`, [
                recipeId,
                recipeData.name,
                recipeData.slug,
                recipeData.cuisine,
                recipeData.mealType,
                recipeData.dietaryRestrictions,
            ]);
            return result.rows[0] || null;
        });
    }
    delete(recipeId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const result = yield connection_1.default.query("DELETE FROM recipes WHERE id = $1", [
                recipeId,
            ]);
            return ((_a = result.rowCount) !== null && _a !== void 0 ? _a : 0) > 0;
        });
    }
};
exports.RecipeRepository = RecipeRepository;
exports.RecipeRepository = RecipeRepository = __decorate([
    (0, tsyringe_1.injectable)()
], RecipeRepository);
