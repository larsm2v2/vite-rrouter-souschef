import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";
import { LogRecipeActivity } from "./LogRecipeActivity";
import { Recipe } from "../01_entities/Recipe";
import { injectable, inject } from "tsyringe";

@injectable()
export class AcceptSharedRecipe {
  constructor(
    @inject(RecipeRepository) private recipeRepository: RecipeRepository,
    @inject(LogRecipeActivity) private logRecipeActivity: LogRecipeActivity,
  ) {}

  async execute(token: string, newUserId: number): Promise<Recipe> {
    const shared = await this.recipeRepository.findByShareToken(token);
    if (!shared) {
      const err: any = new Error("Shared recipe not found");
      err.status = 404;
      throw err;
    }

    const copy = await this.recipeRepository.copyRecipeForUser(
      shared.id,
      newUserId,
    );

    await this.logRecipeActivity.execute({
      userId: newUserId,
      recipeId: copy.id,
      activityType: "received_share",
    });

    return copy;
  }
}

export default AcceptSharedRecipe;
