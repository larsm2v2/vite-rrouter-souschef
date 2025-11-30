import pool from "../../05_frameworks/database/connection";
import { Recipe } from "../../01_entities/Recipe";
import { injectable } from "tsyringe";

@injectable()
export class RecipeRepository {
  async create(recipe: Partial<Recipe>, userId?: number): Promise<Recipe> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Insert main recipe record
      const recipeResult = await client.query(
        `INSERT INTO recipes (user_id, unique_id, name, slug, cuisine, meal_type, dietary_restrictions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          userId || recipe.userId,
          recipe.uniqueId,
          recipe.name,
          recipe.slug,
          recipe.cuisine,
          recipe.mealType,
          recipe.dietaryRestrictions,
        ]
      );
      const savedRecipe = recipeResult.rows[0];
      const recipeId = savedRecipe.id;

      // Insert serving info if provided
      if (recipe.servingInfo) {
        await client.query(
          `INSERT INTO recipe_serving_info (recipe_id, prep_time, cook_time, total_time, servings)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            recipeId,
            recipe.servingInfo.prepTime,
            recipe.servingInfo.cookTime,
            recipe.servingInfo.totalTime,
            recipe.servingInfo.servings,
          ]
        );
      }

      // Insert ingredients if provided
      if (recipe.ingredients && typeof recipe.ingredients === "object") {
        for (const [category, items] of Object.entries(recipe.ingredients)) {
          if (Array.isArray(items) && items.length > 0) {
            await client.query(
              `INSERT INTO recipe_ingredients (recipe_id, category, ingredients)
               VALUES ($1, $2, $3)`,
              [recipeId, category, JSON.stringify(items)]
            );
          }
        }
      }

      // Insert instructions if provided
      if (recipe.instructions && Array.isArray(recipe.instructions)) {
        for (const instruction of recipe.instructions) {
          await client.query(
            `INSERT INTO recipe_instructions (recipe_id, step_number, instruction)
             VALUES ($1, $2, $3)`,
            [
              recipeId,
              instruction.number || instruction.stepNumber,
              instruction.text || instruction.instruction,
            ]
          );
        }
      }

      // Insert notes if provided
      if (recipe.notes && Array.isArray(recipe.notes)) {
        for (const note of recipe.notes) {
          await client.query(
            `INSERT INTO recipe_notes (recipe_id, note)
             VALUES ($1, $2)`,
            [recipeId, note]
          );
        }
      }

      // Insert images if provided (from OCR upload)
      if (recipe.images && Array.isArray(recipe.images)) {
        for (const image of recipe.images) {
          await client.query(
            `INSERT INTO recipe_images (recipe_id, image_url, is_primary)
             VALUES ($1, $2, $3)`,
            [
              recipeId,
              image.imageUrl || image.image_url,
              image.isPrimary || false,
            ]
          );
        }
      }

      await client.query("COMMIT");
      return savedRecipe;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(
    recipeId: number,
    recipeData: Partial<Recipe>,
    userId?: number
  ): Promise<Recipe | null> {
    const result = await pool.query(
      `UPDATE recipes SET name = $2, slug = $3, cuisine = $4, meal_type = $5, dietary_restrictions = $6
       WHERE id = $1 AND user_id = $7 RETURNING *`,
      [
        recipeId,
        recipeData.name,
        recipeData.slug,
        recipeData.cuisine,
        recipeData.mealType,
        recipeData.dietaryRestrictions,
        userId,
      ]
    );
    return result.rows[0] || null;
  }

  async delete(recipeId: number, userId?: number): Promise<boolean> {
    const result = await pool.query("DELETE FROM recipes WHERE id = $1 AND user_id = $2", [
      recipeId,
      userId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }
}
