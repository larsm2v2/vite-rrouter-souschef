import { Recipe } from "../01_entities";
import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";

export class UpdateRecipe {
  constructor(private recipeRepository: RecipeRepository) {}

  async execute(
    recipeId: number,
    recipeData: Partial<Recipe>
  ): Promise<Recipe | null> {
    return this.recipeRepository.update(recipeId, recipeData);
  }
}
