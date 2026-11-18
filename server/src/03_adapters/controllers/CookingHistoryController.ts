import { Request, Response } from "express";
import { User } from "../../01_entities/User";
import { CompleteRecipe, PlannerSettingsUseCase } from "../../02_use_cases";
import { injectable, inject } from "tsyringe";
import { parseIsoDate, toIso, MEAL_TYPES } from "../../utils/mealPlanWeeks";
import { orderSlots } from "../repositories/PlannerSettingsRepository";

const MAX_FAVORITE_THRESHOLD = 50;
const MAX_HOUSEHOLD = 20;

@injectable()
export class CookingHistoryController {
  constructor(
    @inject(CompleteRecipe) private completeRecipe: CompleteRecipe,
    @inject(PlannerSettingsUseCase) private settings: PlannerSettingsUseCase,
  ) {}

  /** POST /recipes/:id/complete  { cookedOn?: YYYY-MM-DD } */
  async complete(req: Request, res: Response): Promise<void> {
    const userId = (req.user as User | undefined)?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const recipeId = Number(req.params.id);
    if (!Number.isInteger(recipeId)) {
      res.status(400).json({ error: "Invalid recipe id" });
      return;
    }
    const cookedOn = req.body?.cookedOn ?? toIso(new Date());
    if (!parseIsoDate(cookedOn)) {
      res.status(400).json({ error: "cookedOn must be a YYYY-MM-DD date" });
      return;
    }
    const result = await this.completeRecipe.execute(userId, recipeId, cookedOn);
    if (!result) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }
    res.status(200).json(result);
  }

  async getSettings(req: Request, res: Response): Promise<void> {
    const userId = (req.user as User | undefined)?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.status(200).json(await this.settings.get(userId));
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    const userId = (req.user as User | undefined)?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { weekStartDay, favoriteThreshold, visibleSlots, householdSize } =
      req.body ?? {};
    if (
      weekStartDay !== undefined &&
      !(Number.isInteger(weekStartDay) && weekStartDay >= 0 && weekStartDay <= 6)
    ) {
      res.status(400).json({ error: "weekStartDay must be an integer 0-6" });
      return;
    }
    if (
      favoriteThreshold !== undefined &&
      !(
        Number.isInteger(favoriteThreshold) &&
        favoriteThreshold >= 0 &&
        favoriteThreshold <= MAX_FAVORITE_THRESHOLD
      )
    ) {
      res.status(400).json({
        error: `favoriteThreshold must be an integer 0-${MAX_FAVORITE_THRESHOLD} (0 disables auto-favorites)`,
      });
      return;
    }
    if (
      visibleSlots !== undefined &&
      !(
        Array.isArray(visibleSlots) &&
        visibleSlots.length > 0 &&
        visibleSlots.every((slot) =>
          (MEAL_TYPES as readonly string[]).includes(slot),
        )
      )
    ) {
      res.status(400).json({
        error: `visibleSlots must list at least one of ${MEAL_TYPES.join(", ")}`,
      });
      return;
    }
    if (
      householdSize !== undefined &&
      !(
        Number.isInteger(householdSize) &&
        householdSize >= 1 &&
        householdSize <= MAX_HOUSEHOLD
      )
    ) {
      res
        .status(400)
        .json({ error: `householdSize must be an integer 1-${MAX_HOUSEHOLD}` });
      return;
    }
    res.status(200).json(
      await this.settings.update(userId, {
        weekStartDay,
        favoriteThreshold,
        householdSize,
        visibleSlots: visibleSlots ? orderSlots(visibleSlots) : undefined,
      }),
    );
  }
}
