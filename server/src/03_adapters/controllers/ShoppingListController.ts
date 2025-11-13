import { Request, Response } from "express";
import {
  GetShoppingListVersion,
  CreateShoppingListVersion,
} from "../../02_use_cases";
import { injectable, inject } from "tsyringe";

@injectable()
export class ShoppingListController {
  constructor(
    @inject(GetShoppingListVersion) private getVersion: GetShoppingListVersion,
    @inject(CreateShoppingListVersion)
    private createVersion: CreateShoppingListVersion
  ) {}

  async getCurrent(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const version = await this.getVersion.execute(userId);
    res.status(200).json(version);
  }

  async create(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const entry = { ...(req.body || {}), userId };
    const created = await this.createVersion.execute(entry);
    res.status(201).json(created);
  }
}
