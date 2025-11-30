import { Request, Response } from "express";
import { CreateRecipe, UpdateRecipe, DeleteRecipe } from "../../02_use_cases";
import { injectable, inject } from "tsyringe";

@injectable()
export class RecipeController {
  constructor(
    @inject(CreateRecipe) private createRecipe: CreateRecipe,
    @inject(UpdateRecipe) private updateRecipe: UpdateRecipe,
    @inject(DeleteRecipe) private deleteRecipe: DeleteRecipe
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const recipeData = req.body;
    // Get user ID from JWT token (set by authenticateJWT middleware)
    const userId = (req as any).user?.id;
    const newRecipe = await this.createRecipe.execute(recipeData, userId);
    res.status(200).json(newRecipe);
  }

  async update(req: Request, res: Response): Promise<void> {
    const recipeId = Number(req.params.id);
    const recipeData = req.body;
    const userId = (req as any).user?.id;
    const updatedRecipe = await this.updateRecipe.execute(recipeId, recipeData, userId);

    if (!updatedRecipe) {
      res.status(404).json({ error: "Recipe not found" });
    } else {
      res.status(200).json(updatedRecipe);
    }
  }
  async delete(req: Request, res: Response): Promise<void> {
    const recipeId = Number(req.params.id);
    const userId = (req as any).user?.id;
    const success = await this.deleteRecipe.execute(recipeId, userId);

    if (!success) {
      res.status(404).json({ error: "Recipe not found" });
    } else {
      res.status(200).json({ message: "Recipe deleted successfully" });
    }
  }
}
