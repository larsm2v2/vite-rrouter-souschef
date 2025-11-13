import { MealPlanRepository } from "../03_adapters/repositories";
import { GetMealPlan } from "../02_use_cases/GetMealPlan";
import { CreateMealPlan } from "../02_use_cases/CreateMealPlan";

export function createGetMealPlan(): GetMealPlan {
  const repo = new MealPlanRepository();
  return new GetMealPlan(repo);
}

export function createCreateMealPlan(): CreateMealPlan {
  const repo = new MealPlanRepository();
  return new CreateMealPlan(repo);
}
