import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";
import { injectable, inject } from "tsyringe";

@injectable()
export class GetRecipeByShareToken {
  constructor(
    @inject(RecipeRepository) private recipeRepository: RecipeRepository,
  ) {}

  async execute(token: string): Promise<any | null> {
    if (!token || typeof token !== "string") return null;
    return this.recipeRepository.findByShareToken(token);
  }
}

export default GetRecipeByShareToken;
