import { Request, Response } from "express";
import { User } from "../../01_entities/User";
import { LogRecipeActivity, GetRecipeActivityLog } from "../../02_use_cases";
import { injectable, inject } from "tsyringe";

@injectable()
export class RecipeActivityController {
  constructor(
    @inject(LogRecipeActivity) private logger: LogRecipeActivity,
    @inject(GetRecipeActivityLog) private getter: GetRecipeActivityLog
  ) {}

  async log(req: Request, res: Response): Promise<void> {
    const userId = (req.user as User).id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const entry = { ...(req.body || {}), userId };
    const created = await this.logger.execute(entry);
    res.status(201).json(created);
  }

  async list(req: Request, res: Response): Promise<void> {
    const userId = (req.user as User).id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const logs = await this.getter.execute(userId);
    res.status(200).json(logs);
  }
}
