import { Request, Response } from "express";
import { CreateRecipe, UpdateRecipe, DeleteRecipe } from "../../02_use_cases";

export class RecipeController {
  constructor(
    private createRecipe: CreateRecipe,
    private updateRecipe: UpdateRecipe,
    private deleteRecipe: DeleteRecipe
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const recipeData = req.body;
    const newRecipe = await this.createRecipe.execute(recipeData);
    res.status(200).json(newRecipe);
  }

  async update(req: Request, res: Response): Promise<void> {
    const recipeId = Number(req.params.id);
    const recipeData = req.body;
    const updatedRecipe = await this.updateRecipe.execute(recipeId, recipeData);

    if (!updatedRecipe) {
      res.status(404).json({ error: "Recipe not found" });
    } else {
      res.status(200).json(updatedRecipe);
    }
  }
  async delete(req: Request, res: Response): Promise<void> {
    const recipeId = Number(req.params.id);
    const success = await this.deleteRecipe.execute(recipeId);

    if (!success) {
      res.status(404).json({ error: "Recipe not found" });
    } else {
      res.status(200).json({ message: "Recipe deleted successfully" });
    }
  }
}
