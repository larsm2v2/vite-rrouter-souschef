import { injectable, inject } from "tsyringe";
import { Request, Response } from "express";
import { GetAlreadyStocked } from "../../02_use_cases/GetAlreadyStocked";
import { UpdateAlreadyStocked } from "../../02_use_cases/UpdateAlreadyStocked";
import { AlreadyStockedRepository } from "../repositories/AlreadyStockedRepository";
import { sanitizeStaples, STARTER_STAPLES } from "../../utils/staples";

function userIdOf(req: Request): number | null {
  return (req.user as { id?: number } | undefined)?.id ?? null;
}

@injectable()
export class AlreadyStockedController {
  constructor(
    @inject(GetAlreadyStocked)
    private getAlreadyStockedUseCase: GetAlreadyStocked,
    @inject(UpdateAlreadyStocked)
    private updateAlreadyStockedUseCase: UpdateAlreadyStocked,
    @inject(AlreadyStockedRepository)
    private repository: AlreadyStockedRepository
  ) {}

  async getAlreadyStocked(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const alreadyStocked = await this.getAlreadyStockedUseCase.execute(userId);
    res.status(200).json(alreadyStocked || { stockedItems: [] });
  }

  /** Replace the whole staples list (the staples screen autosaves this). */
  async updateAlreadyStocked(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const stockedItems = sanitizeStaples(req.body?.stockedItems);
    if (!stockedItems) {
      res.status(400).json({
        error: "stockedItems must be an array of items that each have a name",
      });
      return;
    }

    const updated = await this.updateAlreadyStockedUseCase.execute(
      userId,
      stockedItems
    );
    res.status(200).json(updated);
  }

  /** Add one or more staples without replacing the rest (one-tap add elsewhere in the app). */
  async addItems(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const items = sanitizeStaples(
      Array.isArray(req.body?.items) ? req.body.items : [req.body]
    );
    if (!items || items.length === 0) {
      res.status(400).json({ error: "A staple needs a name" });
      return;
    }

    res.status(200).json(await this.repository.addItems(userId, items));
  }

  suggestions(_req: Request, res: Response): void {
    res.status(200).json({ categories: STARTER_STAPLES });
  }
}
