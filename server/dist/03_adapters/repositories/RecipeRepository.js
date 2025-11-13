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
            const result = yield connection_1.default.query(`INSERT INTO recipes (user_id, unique_id, name, slug, cuisine, meal_type, dietary_restrictions)
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
            return result.rows[0];
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
