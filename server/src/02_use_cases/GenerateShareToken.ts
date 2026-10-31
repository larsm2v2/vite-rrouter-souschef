import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";
import { LogRecipeActivity } from "./LogRecipeActivity";
import { injectable, inject } from "tsyringe";

@injectable()
export class GenerateShareToken {
  constructor(
    @inject(RecipeRepository) private recipeRepository: RecipeRepository,
    @inject(LogRecipeActivity) private logRecipeActivity: LogRecipeActivity,
  ) {}

  async execute(recipeId: number, ownerUserId: number): Promise<string> {
    const token = await this.recipeRepository.generateShareToken(
      recipeId,
      ownerUserId,
    );
    await this.logRecipeActivity.execute({
      userId: ownerUserId,
      recipeId,
      activityType: "shared",
    });
    return token;
  }
}

export default GenerateShareToken;
