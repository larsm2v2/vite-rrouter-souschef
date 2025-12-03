import { Request, Response } from "express";
import { User } from "../../01_entities/User";
import { GetMealPlan, CreateMealPlan } from "../../02_use_cases";
import { injectable, inject } from "tsyringe";

@injectable()
export class MealPlanController {
  constructor(
    @inject(GetMealPlan) private getMealPlan: GetMealPlan,
    @inject(CreateMealPlan) private createMealPlan: CreateMealPlan
  ) {}

  async getForUser(req: Request, res: Response): Promise<void> {
    const userId = (req.user as User).id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const plans = await this.getMealPlan.execute(userId);
    res.status(200).json(plans);
  }

  async create(req: Request, res: Response): Promise<void> {
    const userId = (req.user as User).id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const entry = { ...(req.body || {}), userId };
    const created = await this.createMealPlan.execute(entry);
    res.status(201).json(created);
  }
}
