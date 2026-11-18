import pool from "../../05_frameworks/database/connection";
import { injectable } from "tsyringe";

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{
    rows: any[];
    rowCount: number | null;
  }>;
};

export type CompletionSource = "cook_mode" | "meal_plan";

export interface CompletionResult {
  recorded: boolean;
  cookCount: number;
  isFavorite: boolean;
  autoFavorited: boolean;
}

/**
 * Recompute a recipe's cook_count / last_cooked_on from its completions and
 * auto-favorite it once it reaches the user's threshold, unless the user
 * manually unfavorited it (favorite_locked).
 */
async function refreshStats(
  db: Queryable,
  userId: number,
  recipeId: number,
): Promise<Omit<CompletionResult, "recorded">> {
  const updated = await db.query(
    `UPDATE recipes r
        SET cook_count = c.n, last_cooked_on = c.last
       FROM (
         SELECT COUNT(*)::int AS n, MAX(cooked_on) AS last
           FROM recipe_completions
          WHERE recipe_id = $1 AND user_id = $2
       ) c
      WHERE r.id = $1 AND r.user_id = $2
      RETURNING r.cook_count, r.is_favorite, r.favorite_locked`,
    [recipeId, userId],
  );
  const row = updated.rows[0];
  if (!row) return { cookCount: 0, isFavorite: false, autoFavorited: false };

  const settings = await db.query(
    "SELECT favorite_threshold FROM users WHERE id = $1",
    [userId],
  );
  const threshold: number = settings.rows[0]?.favorite_threshold ?? 0;

  let isFavorite = Boolean(row.is_favorite);
  let autoFavorited = false;
  if (threshold > 0 && row.cook_count >= threshold && !isFavorite && !row.favorite_locked) {
    await db.query("UPDATE recipes SET is_favorite = true WHERE id = $1", [
      recipeId,
    ]);
    isFavorite = true;
    autoFavorited = true;
  }
  return { cookCount: row.cook_count, isFavorite, autoFavorited };
}

/** Record that a recipe was cooked on a day. Returns null when the recipe is not the user's. */
export async function applyCompletion(
  db: Queryable,
  userId: number,
  recipeId: number,
  cookedOn: string,
  source: CompletionSource,
  mealPlanId?: number,
): Promise<CompletionResult | null> {
  const owned = await db.query(
    "SELECT 1 FROM recipes WHERE id = $1 AND user_id = $2",
    [recipeId, userId],
  );
  if (owned.rows.length === 0) return null;

  const inserted = await db.query(
    `INSERT INTO recipe_completions (user_id, recipe_id, cooked_on, source, meal_plan_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, recipe_id, cooked_on) DO NOTHING
     RETURNING id`,
    [userId, recipeId, cookedOn, source, mealPlanId ?? null],
  );
  const stats = await refreshStats(db, userId, recipeId);
  return { recorded: (inserted.rowCount ?? 0) > 0, ...stats };
}

/** Undo the completion created by checking off a planned meal (never cook-mode ones). */
export async function revokeMealPlanCompletion(
  db: Queryable,
  userId: number,
  recipeId: number,
  mealPlanId: number,
): Promise<void> {
  await db.query(
    `DELETE FROM recipe_completions
      WHERE user_id = $1 AND recipe_id = $2 AND meal_plan_id = $3 AND source = 'meal_plan'`,
    [userId, recipeId, mealPlanId],
  );
  await refreshStats(db, userId, recipeId);
}

@injectable()
export class RecipeCompletionRepository {
  async record(
    userId: number,
    recipeId: number,
    cookedOn: string,
    source: CompletionSource,
  ): Promise<CompletionResult | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await applyCompletion(
        client,
        userId,
        recipeId,
        cookedOn,
        source,
      );
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
