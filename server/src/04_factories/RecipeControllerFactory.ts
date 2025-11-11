import { RecipeController } from "../03_adapters/controllers/RecipeController";
import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";
import { CreateRecipe } from "../02_use_cases/CreateRecipe";
import { UpdateRecipe } from "../02_use_cases/UpdateRecipe";
import { DeleteRecipe } from "../02_use_cases/DeleteRecipe";

export function createRecipeController(): RecipeController {
  const recipeRepository = new RecipeRepository();
  const createRecipe = new CreateRecipe(recipeRepository);
  const updateRecipe = new UpdateRecipe(recipeRepository);
  const deleteRecipe = new DeleteRecipe(recipeRepository);

  return new RecipeController(createRecipe, updateRecipe, deleteRecipe);
}
