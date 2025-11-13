import { RecipeActivityLog } from "../01_entities";
import { RecipeActivityLogRepository } from "../03_adapters/repositories";
import { injectable, inject } from "tsyringe";

@injectable()
export class LogRecipeActivity {
  constructor(
    @inject(RecipeActivityLogRepository)
    private repo: RecipeActivityLogRepository
  ) {}

  async execute(entry: Partial<RecipeActivityLog>): Promise<RecipeActivityLog> {
    return this.repo.logActivity(entry);
  }
}

export default LogRecipeActivity;
