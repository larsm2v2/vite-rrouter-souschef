import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";
import { injectable, inject } from "tsyringe";

@injectable()
export class DeleteRecipe {
  constructor(@inject(RecipeRepository) private recipeRepository: RecipeRepository) {}

  async execute(recipeId: number, userId?: number): Promise<boolean> {
    return this.recipeRepository.delete(recipeId, userId);
  }
}
