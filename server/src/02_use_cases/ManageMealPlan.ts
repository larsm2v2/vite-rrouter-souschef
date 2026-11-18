import { MealPlan } from "../01_entities";
import {
  MealPlanRepository,
  PlannerSettingsRepository,
} from "../03_adapters/repositories";
import { CompletionResult } from "../03_adapters/repositories/RecipeCompletionRepository";
import {
  MealPlanPatch,
  LeftoverSlot,
} from "../03_adapters/repositories/MealPlanRepository";
import { groupByWeek, weekStartFor, WeekGroup } from "../utils/mealPlanWeeks";
import { injectable, inject } from "tsyringe";

const HISTORY_ROW_CAP = 3000;

@injectable()
export class ManageMealPlan {
  constructor(
    @inject(MealPlanRepository) private mealPlanRepo: MealPlanRepository,
    @inject(PlannerSettingsRepository)
    private settingsRepo: PlannerSettingsRepository,
  ) {}

  move(id: number, userId: number, patch: MealPlanPatch): Promise<MealPlan | null> {
    return this.mealPlanRepo.update(id, userId, patch);
  }

  addLeftovers(
    sourceId: number,
    userId: number,
    slots: LeftoverSlot[],
  ): Promise<MealPlan[] | null> {
    return this.mealPlanRepo.createLeftovers(sourceId, userId, slots);
  }

  leftoversOf(sourceIds: number[], userId: number): Promise<MealPlan[]> {
    return this.mealPlanRepo.findLeftoversOf(sourceIds, userId);
  }

  remove(id: number, userId: number): Promise<boolean> {
    return this.mealPlanRepo.delete(id, userId);
  }

  setCooked(
    id: number,
    userId: number,
    cooked: boolean,
  ): Promise<{ entry: MealPlan; completion: CompletionResult | null } | null> {
    return this.mealPlanRepo.setCooked(id, userId, cooked);
  }

  /**
   * Past weeks (before the week containing `today`), newest first. Each week
   * is an object holding its entries, so a week can be reviewed or reused.
   */
  async history(
    userId: number,
    today: string,
    weeks: number,
  ): Promise<WeekGroup<MealPlan & { plannedDate: string }>[]> {
    const { weekStartDay } = await this.settingsRepo.get(userId);
    const currentWeekStart = weekStartFor(today, weekStartDay);
    const entries = (await this.mealPlanRepo.findBefore(
      userId,
      currentWeekStart,
      HISTORY_ROW_CAP,
    )) as (MealPlan & { plannedDate: string })[];
    return groupByWeek(entries, weekStartDay).slice(0, weeks);
  }
}

export default ManageMealPlan;
