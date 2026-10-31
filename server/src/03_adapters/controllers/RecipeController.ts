import { Request, Response } from "express";
import {
  CreateRecipe,
  UpdateRecipe,
  DeleteRecipe,
  GenerateShareToken,
  GetRecipeByShareToken,
  AcceptSharedRecipe,
} from "../../02_use_cases";
import { injectable, inject } from "tsyringe";

@injectable()
export class RecipeController {
  constructor(
    @inject(CreateRecipe) private createRecipe: CreateRecipe,
    @inject(UpdateRecipe) private updateRecipe: UpdateRecipe,
    @inject(DeleteRecipe) private deleteRecipe: DeleteRecipe,
    @inject(GenerateShareToken) private generateShareToken: GenerateShareToken,
    @inject(GetRecipeByShareToken)
    private getRecipeByShareToken: GetRecipeByShareToken,
    @inject(AcceptSharedRecipe)
    private acceptSharedRecipeUseCase: AcceptSharedRecipe,
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
    const updatedRecipe = await this.updateRecipe.execute(
      recipeId,
      recipeData,
      userId,
    );

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

  async shareRecipe(req: Request, res: Response): Promise<void> {
    const recipeId = Number(req.params.id);
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!Number.isInteger(recipeId)) {
      res.status(400).json({ error: "Invalid recipe id" });
      return;
    }

    const shareToken = await this.generateShareToken.execute(recipeId, userId);
    const clientUrl = (process.env.CLIENT_URL || "").replace(/\/$/, "");
    const shareUrl = `${clientUrl}/recipes/shared/${shareToken}`;
    res.status(200).json({ shareToken, shareUrl });
  }

  async getSharedRecipe(req: Request, res: Response): Promise<void> {
    const token = req.params.token;
    const row = await this.getRecipeByShareToken.execute(token);

    if (!row) {
      res.status(404).json({ error: "Shared recipe not found" });
      return;
    }

    // Transform to the same snake_case shape the client's RecipeModel
    // expects (matches GET /api/recipes/:id's transform). No owner PII
    // (user_id) is present since findByShareToken never selects it.
    const ingredientsObj: any = {};
    if (row.ingredients && Array.isArray(row.ingredients)) {
      row.ingredients.forEach((item: any) => {
        if (item.category && item.ingredients) {
          ingredientsObj[item.category] = item.ingredients;
        }
      });
    }

    const transformedRecipe = {
      id: row.id.toString(),
      name: row.name || "",
      unique_id: row.unique_id,
      cuisine: row.cuisine || "",
      meal_type: row.meal_type || "",
      dietary_restrictions: row.dietary_restrictions || [],
      serving_info: {
        prep_time: row.prep_time,
        cook_time: row.cook_time,
        total_time: row.total_time,
        servings: row.servings,
      },
      ingredients: ingredientsObj,
      instructions: (row.instructions || []).map((inst: any) => ({
        number: inst.step_number,
        text: inst.instruction,
      })),
      notes: row.notes || [],
      nutrition: row.nutrition_data || {},
    };

    res.status(200).json(transformedRecipe);
  }

  async acceptSharedRecipe(req: Request, res: Response): Promise<void> {
    const token = req.params.token;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const copy = await this.acceptSharedRecipeUseCase.execute(token, userId);
    res.status(201).json({ recipeId: copy.id });
  }
}
