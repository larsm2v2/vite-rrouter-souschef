import { injectable, inject } from "tsyringe";
import { Request, Response } from "express";
import { GetAlreadyStocked } from "../../02_use_cases/GetAlreadyStocked";
import { UpdateAlreadyStocked } from "../../02_use_cases/UpdateAlreadyStocked";
import { StockedItem } from "../../01_entities/AlreadyStocked";

@injectable()
export class AlreadyStockedController {
  constructor(
    @inject("GetAlreadyStocked") private getAlreadyStockedUseCase: GetAlreadyStocked,
    @inject("UpdateAlreadyStocked")
    private updateAlreadyStockedUseCase: UpdateAlreadyStocked
  ) {}

  async getAlreadyStocked(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const alreadyStocked = await this.getAlreadyStockedUseCase.execute(userId);
      res.status(200).json(alreadyStocked || { stockedItems: [] });
    } catch (error) {
      console.error("Error fetching already stocked:", error);
      res.status(500).json({ error: "Failed to fetch already stocked items" });
    }
  }

  async updateAlreadyStocked(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { stockedItems } = req.body;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!Array.isArray(stockedItems)) {
        res.status(400).json({ error: "stockedItems must be an array" });
        return;
      }

      // Validate items structure - only name is required
      for (const item of stockedItems) {
        if (!item.name || typeof item.name !== "string") {
          res.status(400).json({
            error: "Each stocked item must have a name",
          });
          return;
        }
      }

      const updated = await this.updateAlreadyStockedUseCase.execute(
        userId,
        stockedItems
      );
      res.status(200).json(updated);
    } catch (error) {
      console.error("Error updating already stocked:", error);
      res.status(500).json({ error: "Failed to update already stocked items" });
    }
  }
}
