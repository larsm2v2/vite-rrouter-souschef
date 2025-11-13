import { Recipe } from "../01_entities";
import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";
import { injectable, inject } from "tsyringe";

@injectable()
export class UpdateRecipe {
  constructor(@inject(RecipeRepository) private recipeRepository: RecipeRepository) {}

  async execute(
    recipeId: number,
    recipeData: Partial<Recipe>
  ): Promise<Recipe | null> {
    return this.recipeRepository.update(recipeId, recipeData);
  }
}
