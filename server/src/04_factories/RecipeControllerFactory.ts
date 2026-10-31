import { RecipeController } from "../03_adapters/controllers/RecipeController";
import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";
import { RecipeActivityLogRepository } from "../03_adapters/repositories/RecipeActivityLogRepository";
import { CreateRecipe } from "../02_use_cases/CreateRecipe";
import { UpdateRecipe } from "../02_use_cases/UpdateRecipe";
import { DeleteRecipe } from "../02_use_cases/DeleteRecipe";
import { LogRecipeActivity } from "../02_use_cases/LogRecipeActivity";
import { GenerateShareToken } from "../02_use_cases/GenerateShareToken";
import { GetRecipeByShareToken } from "../02_use_cases/GetRecipeByShareToken";
import { AcceptSharedRecipe } from "../02_use_cases/AcceptSharedRecipe";

export function createRecipeController(): RecipeController {
  const recipeRepository = new RecipeRepository();
  const recipeActivityLogRepository = new RecipeActivityLogRepository();
  const logRecipeActivity = new LogRecipeActivity(recipeActivityLogRepository);

  const createRecipe = new CreateRecipe(recipeRepository);
  const updateRecipe = new UpdateRecipe(recipeRepository);
  const deleteRecipe = new DeleteRecipe(recipeRepository);
  const generateShareToken = new GenerateShareToken(
    recipeRepository,
    logRecipeActivity,
  );
  const getRecipeByShareToken = new GetRecipeByShareToken(recipeRepository);
  const acceptSharedRecipe = new AcceptSharedRecipe(
    recipeRepository,
    logRecipeActivity,
  );

  return new RecipeController(
    createRecipe,
    updateRecipe,
    deleteRecipe,
    generateShareToken,
    getRecipeByShareToken,
    acceptSharedRecipe,
  );
}
