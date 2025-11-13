import { Recipe } from "../01_entities";
import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";
import { cleanRecipe as remoteClean } from "../05_frameworks/cleanRecipe/client";
import { injectable, inject } from "tsyringe";

@injectable()
export class CreateRecipe {
  constructor(@inject(RecipeRepository) private recipeRepository: RecipeRepository) {}

  /**
   * Execute create recipe flow using the (optional) microservice for cleaning.
   * Falls back to local cleaning when the microservice is not configured or
   * unavailable. Post-process to ensure the entity shape expected by the
   * repository/use-case (e.g. `uniqueId`, `slug`, `dietaryRestrictions`).
   */
  async execute(recipeData: Partial<Recipe>): Promise<Recipe> {
    // Preserve original validation behavior: name is required
    if (!recipeData || !recipeData.name) {
      throw new Error("Recipe name is required");
    }

    // Call the async wrapper which may use the microservice or local cleaner.
    // The wrapper now returns canonical camelCase fields (uniqueId, slug,
    // dietaryRestrictions, servingInfo, instructions.stepNumber); we forward
    // the cleaned payload directly to the repository.
    const cleaned: any = await remoteClean(recipeData as any);
    return this.recipeRepository.create(cleaned as Recipe);
  }
}
