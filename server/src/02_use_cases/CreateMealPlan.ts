import { MealPlan } from "../01_entities";
import { MealPlanRepository } from "../03_adapters/repositories";
import { injectable, inject } from "tsyringe";

@injectable()
export class CreateMealPlan {
  constructor(
    @inject(MealPlanRepository) private mealPlanRepo: MealPlanRepository
  ) {}

  async execute(entry: Partial<MealPlan>): Promise<MealPlan> {
    return this.mealPlanRepo.create(entry);
  }
}

export default CreateMealPlan;
