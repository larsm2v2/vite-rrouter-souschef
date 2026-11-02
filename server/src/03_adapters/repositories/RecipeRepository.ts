import pool from "../../05_frameworks/database/connection";
import { Recipe } from "../../01_entities/Recipe";
import { injectable } from "tsyringe";
import crypto from "crypto";

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
        ],
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
          ],
        );
      }

      // Insert ingredients if provided
      if (recipe.ingredients && typeof recipe.ingredients === "object") {
        for (const [category, items] of Object.entries(recipe.ingredients)) {
          if (Array.isArray(items) && items.length > 0) {
            await client.query(
              `INSERT INTO recipe_ingredients (recipe_id, category, ingredients)
               VALUES ($1, $2, $3)`,
              [recipeId, category, JSON.stringify(items)],
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
            ],
          );
        }
      }

      // Insert notes if provided
      if (recipe.notes && Array.isArray(recipe.notes)) {
        for (const note of recipe.notes) {
          await client.query(
            `INSERT INTO recipe_notes (recipe_id, note)
             VALUES ($1, $2)`,
            [recipeId, note],
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
            ],
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
    userId: number,
  ): Promise<Recipe | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        "SELECT id, name, slug FROM recipes WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [recipeId, userId],
      );
      if (current.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      const nameSlug =
        String(recipeData.name ?? "recipe")
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "recipe";
      const slug =
        recipeData.name === undefined ||
        recipeData.name === current.rows[0].name
          ? current.rows[0].slug
          : `${nameSlug}-${recipeId}-${crypto.randomBytes(3).toString("hex")}`;

      const result = await client.query(
        `UPDATE recipes SET name = $1, slug = $2, cuisine = $3, meal_type = $4,
           dietary_restrictions = $5, updated_at = NOW()
         WHERE id = $6 AND user_id = $7 RETURNING *`,
        [
          recipeData.name,
          slug,
          recipeData.cuisine ?? "",
          recipeData.mealType ?? "",
          recipeData.dietaryRestrictions ?? [],
          recipeId,
          userId,
        ],
      );

      const servingInfo = recipeData.servingInfo;
      if (servingInfo) {
        await client.query(
          `INSERT INTO recipe_serving_info (recipe_id, prep_time, cook_time, total_time, servings)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (recipe_id) DO UPDATE SET
             prep_time = EXCLUDED.prep_time, cook_time = EXCLUDED.cook_time,
             total_time = EXCLUDED.total_time, servings = EXCLUDED.servings`,
          [
            recipeId,
            servingInfo.prepTime ?? "",
            servingInfo.cookTime ?? "",
            servingInfo.totalTime ?? "",
            servingInfo.servings ?? 0,
          ],
        );
      }

      await client.query(
        "DELETE FROM recipe_ingredients WHERE recipe_id = $1",
        [recipeId],
      );
      for (const [category, items] of Object.entries(
        recipeData.ingredients ?? {},
      )) {
        if (items.length === 0) continue;
        await client.query(
          "INSERT INTO recipe_ingredients (recipe_id, category, ingredients) VALUES ($1, $2, $3)",
          [recipeId, category, JSON.stringify(items)],
        );
      }

      await client.query(
        "DELETE FROM recipe_instructions WHERE recipe_id = $1",
        [recipeId],
      );
      for (const [index, instruction] of (
        recipeData.instructions ?? []
      ).entries()) {
        await client.query(
          "INSERT INTO recipe_instructions (recipe_id, step_number, instruction) VALUES ($1, $2, $3)",
          [
            recipeId,
            index + 1,
            instruction.instruction ?? instruction.text ?? "",
          ],
        );
      }

      await client.query("DELETE FROM recipe_notes WHERE recipe_id = $1", [
        recipeId,
      ]);
      for (const note of recipeData.notes ?? []) {
        await client.query(
          "INSERT INTO recipe_notes (recipe_id, note) VALUES ($1, $2)",
          [recipeId, note],
        );
      }

      await client.query("COMMIT");
      return result.rows[0] as Recipe;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(recipeId: number, userId?: number): Promise<boolean> {
    const result = await pool.query(
      "DELETE FROM recipes WHERE id = $1 AND user_id = $2",
      [recipeId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Generate (or reuse) a share token for a recipe. Only the recipe owner
   * may generate a share token.
   */
  async generateShareToken(
    recipeId: number,
    ownerUserId: number,
  ): Promise<string> {
    const existing = await pool.query(
      `SELECT user_id, share_token FROM recipes WHERE id = $1`,
      [recipeId],
    );

    if (existing.rows.length === 0) {
      const err: any = new Error("Recipe not found");
      err.status = 404;
      throw err;
    }

    const row = existing.rows[0];
    if (row.user_id !== ownerUserId) {
      const err: any = new Error("Not authorized to share this recipe");
      err.status = 403;
      throw err;
    }

    if (row.share_token) {
      return row.share_token;
    }

    const token = crypto.randomBytes(24).toString("base64url");
    await pool.query(`UPDATE recipes SET share_token = $1 WHERE id = $2`, [
      token,
      recipeId,
    ]);
    return token;
  }

  /**
   * Look up a recipe by its share token. Returns a read-only shape (no
   * owner PII: no `user_id`/`id` beyond what's needed to accept the share).
   */
  async findByShareToken(token: string): Promise<any | null> {
    const result = await pool.query(
      `
      SELECT
        r.id, r.unique_id, r.name, r.slug, r.cuisine, r.meal_type, r.dietary_restrictions,
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
        rnut.nutrition_data,
        (
          SELECT json_agg(jsonb_build_object('imageUrl', img.image_url, 'isPrimary', img.is_primary))
          FROM recipe_images img
          WHERE img.recipe_id = r.id
        ) AS images
      FROM recipes r
      LEFT JOIN recipe_serving_info rsi ON r.id = rsi.recipe_id
      LEFT JOIN recipe_nutrition rnut ON r.id = rnut.recipe_id
      WHERE r.share_token = $1
      `,
      [token],
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  /**
   * Copy a shared recipe (and all its related rows) into a new, independent
   * recipe owned by `newUserId`. Does NOT copy the source's `share_token`,
   * `is_favorite`, `last_viewed_at`, or `cooking_dates`.
   */
  async copyRecipeForUser(
    sourceRecipeId: number,
    newUserId: number,
  ): Promise<Recipe> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const sourceResult = await client.query(
        `SELECT * FROM recipes WHERE id = $1`,
        [sourceRecipeId],
      );
      if (sourceResult.rows.length === 0) {
        const err: any = new Error("Recipe not found");
        err.status = 404;
        throw err;
      }
      const source = sourceResult.rows[0];

      const newUniqueId = Date.now();
      const newSlug = `${source.slug}-${crypto.randomBytes(3).toString("hex")}`;

      const insertResult = await client.query(
        `INSERT INTO recipes (user_id, unique_id, name, slug, cuisine, meal_type, dietary_restrictions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          newUserId,
          newUniqueId,
          source.name,
          newSlug,
          source.cuisine,
          source.meal_type,
          source.dietary_restrictions,
        ],
      );
      const newRecipe = insertResult.rows[0];
      const newRecipeId = newRecipe.id;

      const servingInfo = await client.query(
        `SELECT * FROM recipe_serving_info WHERE recipe_id = $1`,
        [sourceRecipeId],
      );
      if (servingInfo.rows.length > 0) {
        const si = servingInfo.rows[0];
        await client.query(
          `INSERT INTO recipe_serving_info (recipe_id, prep_time, cook_time, total_time, servings)
           VALUES ($1, $2, $3, $4, $5)`,
          [newRecipeId, si.prep_time, si.cook_time, si.total_time, si.servings],
        );
      }

      const ingredients = await client.query(
        `SELECT * FROM recipe_ingredients WHERE recipe_id = $1`,
        [sourceRecipeId],
      );
      for (const row of ingredients.rows) {
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id, category, ingredients)
           VALUES ($1, $2, $3)`,
          [newRecipeId, row.category, row.ingredients],
        );
      }

      const instructions = await client.query(
        `SELECT * FROM recipe_instructions WHERE recipe_id = $1`,
        [sourceRecipeId],
      );
      for (const row of instructions.rows) {
        await client.query(
          `INSERT INTO recipe_instructions (recipe_id, step_number, instruction)
           VALUES ($1, $2, $3)`,
          [newRecipeId, row.step_number, row.instruction],
        );
      }

      const notes = await client.query(
        `SELECT * FROM recipe_notes WHERE recipe_id = $1`,
        [sourceRecipeId],
      );
      for (const row of notes.rows) {
        await client.query(
          `INSERT INTO recipe_notes (recipe_id, note) VALUES ($1, $2)`,
          [newRecipeId, row.note],
        );
      }

      const images = await client.query(
        `SELECT * FROM recipe_images WHERE recipe_id = $1`,
        [sourceRecipeId],
      );
      for (const row of images.rows) {
        await client.query(
          `INSERT INTO recipe_images (recipe_id, image_url, is_primary)
           VALUES ($1, $2, $3)`,
          [newRecipeId, row.image_url, row.is_primary],
        );
      }

      const nutrition = await client.query(
        `SELECT * FROM recipe_nutrition WHERE recipe_id = $1`,
        [sourceRecipeId],
      );
      if (nutrition.rows.length > 0) {
        await client.query(
          `INSERT INTO recipe_nutrition (recipe_id, nutrition_data) VALUES ($1, $2)`,
          [newRecipeId, nutrition.rows[0].nutrition_data],
        );
      }

      await client.query("COMMIT");
      return newRecipe;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
