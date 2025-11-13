import { MealPlan } from "../01_entities";
import { MealPlanRepository } from "../03_adapters/repositories";
import { injectable, inject } from "tsyringe";

@injectable()
export class GetMealPlan {
  constructor(
    @inject(MealPlanRepository) private mealPlanRepo: MealPlanRepository
  ) {}

  async execute(userId: number): Promise<MealPlan[]> {
    return this.mealPlanRepo.findByUserId(userId);
  }
}

export default GetMealPlan;
