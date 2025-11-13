import { RecipeActivityLog } from "../01_entities";
import { RecipeActivityLogRepository } from "../03_adapters/repositories";
import { injectable, inject } from "tsyringe";

@injectable()
export class GetRecipeActivityLog {
  constructor(
    @inject(RecipeActivityLogRepository)
    private repo: RecipeActivityLogRepository
  ) {}

  async execute(userId: number): Promise<RecipeActivityLog[]> {
    return this.repo.findByUser(userId);
  }
}

export default GetRecipeActivityLog;
