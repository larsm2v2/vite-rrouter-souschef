import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";

export class DeleteRecipe {
  constructor(private recipeRepository: RecipeRepository) {}

  async execute(recipeId: number): Promise<boolean> {
    return this.recipeRepository.delete(recipeId);
  }
}
