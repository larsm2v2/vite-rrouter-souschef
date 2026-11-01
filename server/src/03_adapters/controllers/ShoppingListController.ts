import { Request, Response } from "express";
import { User } from "../../01_entities/User";
import {
  GetShoppingListVersion,
  CreateShoppingListVersion,
} from "../../02_use_cases";
import { injectable, inject } from "tsyringe";
import { VersionConflictError } from "../repositories/ShoppingListVersionRepository";
import { validateGroceryList } from "../../utils/groceryListValidation";

@injectable()
export class ShoppingListController {
  constructor(
    @inject(GetShoppingListVersion) private getVersion: GetShoppingListVersion,
    @inject(CreateShoppingListVersion)
    private createVersion: CreateShoppingListVersion,
  ) {}

  async getCurrent(req: Request, res: Response): Promise<void> {
    const userId = (req.user as User).id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const version = await this.getVersion.execute(userId);
    res.status(200).json(version);
  }

  async create(req: Request, res: Response): Promise<void> {
    const userId = (req.user as User).id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const checked = validateGroceryList(req.body?.listData);
    if ("error" in checked) {
      res.status(400).json({ error: checked.error });
      return;
    }

    let baseVersion: number | undefined;
    if (req.body?.baseVersion !== undefined && req.body?.baseVersion !== null) {
      const requested = req.body.baseVersion;
      if (
        typeof requested !== "number" ||
        !Number.isInteger(requested) ||
        requested < 0
      ) {
        res
          .status(400)
          .json({ error: "baseVersion must be a non-negative integer" });
        return;
      }
      baseVersion = requested;
    }

    try {
      const created = await this.createVersion.execute(
        userId,
        checked.items,
        baseVersion,
      );
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof VersionConflictError) {
        // The caller's list is stale; hand back the current one instead of overwriting it.
        res.status(409).json({ error: error.message, current: error.current });
        return;
      }
      throw error;
    }
  }
}
