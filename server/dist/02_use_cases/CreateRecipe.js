"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRecipe = void 0;
const RecipeRepository_1 = require("../03_adapters/repositories/RecipeRepository");
const client_1 = require("../05_frameworks/cleanRecipe/client");
const tsyringe_1 = require("tsyringe");
let CreateRecipe = class CreateRecipe {
    constructor(recipeRepository) {
        this.recipeRepository = recipeRepository;
    }
    /**
     * Execute create recipe flow using the (optional) microservice for cleaning.
     * Falls back to local cleaning when the microservice is not configured or
     * unavailable. Post-process to ensure the entity shape expected by the
     * repository/use-case (e.g. `uniqueId`, `slug`, `dietaryRestrictions`).
     */
    execute(recipeData) {
        return __awaiter(this, void 0, void 0, function* () {
            // Preserve original validation behavior: name is required
            if (!recipeData || !recipeData.name) {
                throw new Error("Recipe name is required");
            }
            // Call the async wrapper which may use the microservice or local cleaner.
            // The wrapper now returns canonical camelCase fields (uniqueId, slug,
            // dietaryRestrictions, servingInfo, instructions.stepNumber); we forward
            // the cleaned payload directly to the repository.
            const cleaned = yield (0, client_1.cleanRecipe)(recipeData);
            return this.recipeRepository.create(cleaned);
        });
    }
};
exports.CreateRecipe = CreateRecipe;
exports.CreateRecipe = CreateRecipe = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(RecipeRepository_1.RecipeRepository)),
    __metadata("design:paramtypes", [RecipeRepository_1.RecipeRepository])
], CreateRecipe);
