import { Router, Request, Response, NextFunction } from "express";
import { authenticateJWT } from "../jwtAuth";
import db from "../../database/connection";
import { cleanRecipe } from "../../cleanRecipe/client";

console.log("📥 Importing clean-recipes.routes");
const router = Router();

/**
 * POST /clean-recipes
 * Fetch all recipes and clean them using the clean-recipe microservice
 */
router.post(
  "/",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Fetch all recipes from database
      const result = await db.query(`
        SELECT 
          r.*,
          rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings,
          json_agg(DISTINCT jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients)) FILTER (WHERE ri.category IS NOT NULL) AS ingredients,
          json_agg(jsonb_build_object('step_number', inst.step_number, 'instruction', inst.instruction) ORDER BY inst.step_number) FILTER (WHERE inst.step_number IS NOT NULL) AS instructions,
          json_agg(DISTINCT rn.note) FILTER (WHERE rn.note IS NOT NULL) AS notes,
          rnut.nutrition_data
        FROM recipes r
        LEFT JOIN recipe_serving_info rsi ON r.id = rsi.recipe_id
        LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
        LEFT JOIN recipe_instructions inst ON r.id = inst.recipe_id
        LEFT JOIN recipe_notes rn ON r.id = rn.recipe_id
        LEFT JOIN recipe_nutrition rnut ON r.id = rnut.recipe_id
        GROUP BY r.id, rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings, rnut.nutrition_data
        ORDER BY r.created_at DESC
      `);

      // Clean each recipe using the microservice
      const cleanedRecipes = await Promise.all(
        result.rows.map(async (recipe) => {
          try {
            return await cleanRecipe(recipe);
          } catch (error) {
            console.error(`Failed to clean recipe ${recipe.id}:`, error);
            // Return original recipe if cleaning fails
            return recipe;
          }
        })
      );

      res.json({ data: cleanedRecipes });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
