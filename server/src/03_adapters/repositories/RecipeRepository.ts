import pool from "../../config/database";
import { Recipe } from "../../01_entities/Recipe";

export class RecipeRepository {
  async create(recipe: Partial<Recipe>): Promise<Recipe> {
    const result = await pool.query(
      `INSERT INTO recipes (user_id, unique_id, name, slug, cuisine, meal_type, dietary_restrictions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        recipe.userId,
        recipe.uniqueId,
        recipe.name,
        recipe.slug,
        recipe.cuisine,
        recipe.mealType,
        recipe.dietaryRestrictions,
      ]
    );
    return result.rows[0];
  }

  async update(
    recipeId: number,
    recipeData: Partial<Recipe>
  ): Promise<Recipe | null> {
    const result = await pool.query(
      `UPDATE recipes SET name = $2, slug = $3, cuisine = $4, meal_type = $5, dietary_restrictions = $6
       WHERE id = $1 RETURNING *`,
      [
        recipeId,
        recipeData.name,
        recipeData.slug,
        recipeData.cuisine,
        recipeData.mealType,
        recipeData.dietaryRestrictions,
      ]
    );
    return result.rows[0] || null;
  }

  async delete(recipeId: number): Promise<boolean> {
    const result = await pool.query("DELETE FROM recipes WHERE id = $1", [
      recipeId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }
}
