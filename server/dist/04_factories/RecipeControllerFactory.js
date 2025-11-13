"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRecipeController = createRecipeController;
const RecipeController_1 = require("../03_adapters/controllers/RecipeController");
const RecipeRepository_1 = require("../03_adapters/repositories/RecipeRepository");
const CreateRecipe_1 = require("../02_use_cases/CreateRecipe");
const UpdateRecipe_1 = require("../02_use_cases/UpdateRecipe");
const DeleteRecipe_1 = require("../02_use_cases/DeleteRecipe");
function createRecipeController() {
    const recipeRepository = new RecipeRepository_1.RecipeRepository();
    const createRecipe = new CreateRecipe_1.CreateRecipe(recipeRepository);
    const updateRecipe = new UpdateRecipe_1.UpdateRecipe(recipeRepository);
    const deleteRecipe = new DeleteRecipe_1.DeleteRecipe(recipeRepository);
    return new RecipeController_1.RecipeController(createRecipe, updateRecipe, deleteRecipe);
}
