import { Request, Response } from "express";
import { User } from "../../01_entities/User";
import { GetGroceryList } from "../../02_use_cases";
import { injectable, inject } from "tsyringe";

@injectable()
export class GroceryController {
  constructor(@inject(GetGroceryList) private getGroceryList: GetGroceryList) {}

  async getList(req: Request, res: Response): Promise<void> {
    const userId = (req.user as User).id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const groceryList = await this.getGroceryList.execute(userId);
    res.status(200).json(groceryList);
  }
}
