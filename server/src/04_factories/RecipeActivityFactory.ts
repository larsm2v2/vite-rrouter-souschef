import { RecipeActivityLogRepository } from "../03_adapters/repositories";
import { LogRecipeActivity } from "../02_use_cases/LogRecipeActivity";
import { GetRecipeActivityLog } from "../02_use_cases/GetRecipeActivityLog";

export function createLogRecipeActivity(): LogRecipeActivity {
  const repo = new RecipeActivityLogRepository();
  return new LogRecipeActivity(repo);
}

export function createGetRecipeActivityLog(): GetRecipeActivityLog {
  const repo = new RecipeActivityLogRepository();
  return new GetRecipeActivityLog(repo);
}
