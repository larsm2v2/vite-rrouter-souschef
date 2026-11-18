import { Request, Response } from "express";
import { User } from "../../01_entities/User";
import {
  GetMealPlan,
  CreateMealPlan,
  ManageMealPlan,
} from "../../02_use_cases";
import type { MealPlan } from "../../01_entities/MealPlan";
import { injectable, inject } from "tsyringe";
import {
  MEAL_TYPES,
  addDays,
  daysBetween,
  parseIsoDate,
  toIso,
} from "../../utils/mealPlanWeeks";
import { PlannerRuleError } from "../repositories/MealPlanRepository";

const MAX_RANGE_DAYS = 366;
const MAX_HISTORY_WEEKS = 52;
const MAX_LEFTOVER_SLOTS = 10;

function userIdOf(req: Request): number | null {
  return (req.user as User | undefined)?.id ?? null;
}

function isMealType(value: unknown): value is (typeof MEAL_TYPES)[number] {
  return typeof value === "string" && (MEAL_TYPES as readonly string[]).includes(value);
}

/** Recipe scale for a planned meal: 1x up to 4x in half steps. */
function isMultiplier(value: unknown): value is number {
  return (
    typeof value === "number" &&
    value >= 1 &&
    value <= 4 &&
    Number.isInteger(value * 2)
  );
}

@injectable()
export class MealPlanController {
  constructor(
    @inject(GetMealPlan) private getMealPlan: GetMealPlan,
    @inject(CreateMealPlan) private createMealPlan: CreateMealPlan,
    @inject(ManageMealPlan) private manageMealPlan: ManageMealPlan,
  ) {}

  /** GET /meal-plan[?start=YYYY-MM-DD&end=YYYY-MM-DD] */
  async getForUser(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { start, end } = req.query;
    if (start === undefined && end === undefined) {
      res.status(200).json(await this.getMealPlan.execute(userId));
      return;
    }
    if (!parseIsoDate(start) || !parseIsoDate(end)) {
      res.status(400).json({ error: "start and end must be YYYY-MM-DD dates" });
      return;
    }
    const span = daysBetween(start as string, end as string);
    if (span < 0 || span >= MAX_RANGE_DAYS) {
      res.status(400).json({
        error: `Range must be between 1 and ${MAX_RANGE_DAYS} days`,
      });
      return;
    }
    res
      .status(200)
      .json(
        await this.getMealPlan.execute(userId, {
          start: start as string,
          end: end as string,
        }),
      );
  }

  /** GET /meal-plan/history[?today=YYYY-MM-DD&weeks=8] */
  async history(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const today = req.query.today === undefined ? toIso(new Date()) : req.query.today;
    if (!parseIsoDate(today)) {
      res.status(400).json({ error: "today must be a YYYY-MM-DD date" });
      return;
    }
    const requested = Number(req.query.weeks ?? 8);
    const weeks = Number.isInteger(requested)
      ? Math.min(Math.max(requested, 1), MAX_HISTORY_WEEKS)
      : 8;
    res
      .status(200)
      .json(await this.manageMealPlan.history(userId, today as string, weeks));
  }

  async create(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { recipeId, plannedDate, mealType, multiplier } = req.body ?? {};
    const recipeNumber = Number(recipeId);
    if (!Number.isInteger(recipeNumber) || recipeNumber <= 0) {
      res.status(400).json({ error: "recipeId must be a positive integer" });
      return;
    }
    if (!parseIsoDate(plannedDate)) {
      res.status(400).json({ error: "plannedDate must be a YYYY-MM-DD date" });
      return;
    }
    if (mealType !== undefined && !isMealType(mealType)) {
      res
        .status(400)
        .json({ error: `mealType must be one of ${MEAL_TYPES.join(", ")}` });
      return;
    }
    if (multiplier !== undefined && !isMultiplier(multiplier)) {
      res
        .status(400)
        .json({ error: "multiplier must be 1 to 4 in steps of 0.5" });
      return;
    }

    const created = await this.createMealPlan.execute({
      userId,
      recipeId: recipeNumber,
      plannedDate,
      mealType: mealType ?? "dinner",
      multiplier,
    });
    if (!created) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }
    res.status(201).json(created);
  }

  /** PATCH /meal-plan/:id  { plannedDate?, mealType? } - move an entry. */
  async move(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = Number(req.params.id);
    const { plannedDate, mealType } = req.body ?? {};
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid entry id" });
      return;
    }
    if (plannedDate !== undefined && !parseIsoDate(plannedDate)) {
      res.status(400).json({ error: "plannedDate must be a YYYY-MM-DD date" });
      return;
    }
    if (mealType !== undefined && !isMealType(mealType)) {
      res
        .status(400)
        .json({ error: `mealType must be one of ${MEAL_TYPES.join(", ")}` });
      return;
    }
    if (
      plannedDate === undefined &&
      mealType === undefined &&
      req.body?.multiplier === undefined
    ) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    const { multiplier } = req.body ?? {};
    if (multiplier !== undefined && !isMultiplier(multiplier)) {
      res
        .status(400)
        .json({ error: "multiplier must be 1 to 4 in steps of 0.5" });
      return;
    }

    try {
      const moved = await this.manageMealPlan.move(id, userId, {
        plannedDate,
        mealType,
        multiplier,
      });
      if (!moved) {
        res.status(404).json({ error: "Planned meal not found" });
        return;
      }
      res.status(200).json(moved);
    } catch (error) {
      if (error instanceof PlannerRuleError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  }

  /** POST /meal-plan/:id/leftovers  { slots: [{ plannedDate, mealType }] } */
  async addLeftovers(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = Number(req.params.id);
    const slots = req.body?.slots;
    if (
      !Number.isInteger(id) ||
      !Array.isArray(slots) ||
      slots.length === 0 ||
      slots.length > MAX_LEFTOVER_SLOTS ||
      !slots.every(
        (slot) =>
          slot && parseIsoDate(slot.plannedDate) && isMealType(slot.mealType),
      )
    ) {
      res.status(400).json({
        error: `Provide 1-${MAX_LEFTOVER_SLOTS} slots, each with a plannedDate and mealType`,
      });
      return;
    }

    try {
      const created = await this.manageMealPlan.addLeftovers(
        id,
        userId,
        slots.map((slot) => ({
          plannedDate: slot.plannedDate,
          mealType: slot.mealType,
        })),
      );
      if (!created) {
        res.status(404).json({ error: "Planned meal not found" });
        return;
      }
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof PlannerRuleError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid entry id" });
      return;
    }
    const removed = await this.manageMealPlan.remove(id, userId);
    if (!removed) {
      res.status(404).json({ error: "Planned meal not found" });
      return;
    }
    res.status(200).json({ success: true });
  }

  /** POST /meal-plan/:id/cooked  { cooked?: boolean } */
  async setCooked(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = Number(req.params.id);
    const cooked = req.body?.cooked ?? true;
    if (!Number.isInteger(id) || typeof cooked !== "boolean") {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const result = await this.manageMealPlan.setCooked(id, userId, cooked);
    if (!result) {
      res.status(404).json({ error: "Planned meal not found" });
      return;
    }
    res.status(200).json(result);
  }

  /** POST /meal-plan/copy-week  { fromStart, toStart } - reuse a past week. */
  async copyWeek(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { fromStart, toStart } = req.body ?? {};
    if (!parseIsoDate(fromStart) || !parseIsoDate(toStart)) {
      res
        .status(400)
        .json({ error: "fromStart and toStart must be YYYY-MM-DD dates" });
      return;
    }
    const source = await this.getMealPlan.execute(userId, {
      start: fromStart,
      end: addDays(fromStart, 6),
    });
    const offset = daysBetween(fromStart, toStart);
    // Copy meals first so their leftovers can be re-linked to the new copies.
    const copies = [];
    const copiedIds = new Map<number, number>();
    for (const entry of source.filter((item) => item.kind !== "leftover")) {
      if (!entry.recipeId) continue;
      const created = await this.createMealPlan.execute({
        userId,
        recipeId: entry.recipeId,
        plannedDate: addDays(entry.plannedDate as string, offset),
        mealType: entry.mealType,
        multiplier: entry.multiplier,
      });
      if (created) {
        copies.push(created);
        copiedIds.set(entry.id, created.id);
      }
    }
    // A leftover is only copied together with the meal that made it, even when
    // it falls outside the copied week.
    const leftoversBySource = new Map<number, MealPlan[]>();
    const allLeftovers = await this.manageMealPlan.leftoversOf(
      [...copiedIds.keys()],
      userId,
    );
    for (const entry of allLeftovers) {
      if (!entry.sourceEntryId) continue;
      leftoversBySource.set(entry.sourceEntryId, [
        ...(leftoversBySource.get(entry.sourceEntryId) ?? []),
        entry,
      ]);
    }
    for (const [oldId, leftovers] of leftoversBySource) {
      const created = await this.manageMealPlan.addLeftovers(
        copiedIds.get(oldId) as number,
        userId,
        leftovers.map((entry) => ({
          plannedDate: addDays(entry.plannedDate as string, offset),
          mealType: entry.mealType as string,
        })),
      );
      if (created) copies.push(...created);
    }
    res.status(201).json(copies);
  }
}
