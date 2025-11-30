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
          (
            SELECT json_agg(jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients))
            FROM recipe_ingredients ri
            WHERE ri.recipe_id = r.id
          ) AS ingredients,
          (
            SELECT json_agg(jsonb_build_object('step_number', inst.step_number, 'instruction', inst.instruction) ORDER BY inst.step_number)
            FROM recipe_instructions inst
            WHERE inst.recipe_id = r.id
          ) AS instructions,
          (
            SELECT json_agg(rn.note)
            FROM recipe_notes rn
            WHERE rn.recipe_id = r.id
          ) AS notes,
          rnut.nutrition_data
        FROM recipes r
        LEFT JOIN recipe_serving_info rsi ON r.id = rsi.recipe_id
        LEFT JOIN recipe_nutrition rnut ON r.id = rnut.recipe_id
        WHERE r.user_id = $1
        ORDER BY r.created_at DESC
      `, [req.user?.id]);

      // Clean each recipe using the microservice
      const cleanedRecipes = await Promise.all(
        result.rows.map(async (recipe) => {
          try {
            const cleaned = await cleanRecipe(recipe);
            // Return snake_case format to match frontend interfaces
            return {
              ...cleaned,
              meal_type:
                cleaned.mealType ||
                cleaned.meal_type ||
                recipe.meal_type ||
                "Other",
              id: cleaned.id?.toString() || recipe.id?.toString(),
              unique_id:
                cleaned.uniqueId || cleaned.unique_id || recipe.unique_id,
              dietary_restrictions:
                cleaned.dietaryRestrictions ||
                cleaned.dietary_restrictions ||
                recipe.dietary_restrictions ||
                [],
            };
          } catch (error) {
            console.error(`Failed to clean recipe ${recipe.id}:`, error);
            // Return recipe with snake_case format
            return {
              ...recipe,
              id: recipe.id?.toString(),
              unique_id: recipe.unique_id,
              meal_type: recipe.meal_type || "Other",
              dietary_restrictions: recipe.dietary_restrictions || [],
            };
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
