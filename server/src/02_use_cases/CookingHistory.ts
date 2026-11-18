import {
  RecipeCompletionRepository,
  PlannerSettingsRepository,
} from "../03_adapters/repositories";
import {
  CompletionResult,
} from "../03_adapters/repositories/RecipeCompletionRepository";
import { PlannerSettings } from "../03_adapters/repositories/PlannerSettingsRepository";
import { injectable, inject } from "tsyringe";

@injectable()
export class CompleteRecipe {
  constructor(
    @inject(RecipeCompletionRepository)
    private completions: RecipeCompletionRepository,
  ) {}

  execute(
    userId: number,
    recipeId: number,
    cookedOn: string,
  ): Promise<CompletionResult | null> {
    return this.completions.record(userId, recipeId, cookedOn, "cook_mode");
  }
}

@injectable()
export class PlannerSettingsUseCase {
  constructor(
    @inject(PlannerSettingsRepository)
    private settings: PlannerSettingsRepository,
  ) {}

  get(userId: number): Promise<PlannerSettings> {
    return this.settings.get(userId);
  }

  update(userId: number, patch: Partial<PlannerSettings>): Promise<PlannerSettings> {
    return this.settings.update(userId, patch);
  }
}
