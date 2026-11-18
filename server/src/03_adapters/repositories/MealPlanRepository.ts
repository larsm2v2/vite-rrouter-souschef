import pool from "../../05_frameworks/database/connection";
import { MealPlan } from "../../01_entities/MealPlan";
import { injectable } from "tsyringe";
import {
  applyCompletion,
  revokeMealPlanCompletion,
  CompletionResult,
} from "./RecipeCompletionRepository";

// plannedDate is formatted in SQL so it stays a plain YYYY-MM-DD string and
// never shifts across timezones the way a JS Date would.
const SELECT_ENTRY = `
  SELECT mp.id, mp.user_id AS "userId", mp.recipe_id AS "recipeId",
         COALESCE(r.name, mp.recipe_name) AS "recipeName",
         (SELECT ri.image_url FROM recipe_images ri
           WHERE ri.recipe_id = mp.recipe_id
           ORDER BY ri.is_primary DESC, ri.id LIMIT 1) AS "imageUrl",
         to_char(mp.planned_date, 'YYYY-MM-DD') AS "plannedDate",
         mp.meal_type AS "mealType", mp.is_cooked AS "isCooked",
         mp.kind, mp.source_entry_id AS "sourceEntryId",
         mp.multiplier::float8 AS multiplier,
         (SELECT COUNT(*)::int FROM meal_plan l WHERE l.source_entry_id = mp.id) AS "leftoverCount",
         mp.cooked_date AS "cookedDate",
         mp.created_at AS "createdAt", mp.updated_at AS "updatedAt"
    FROM meal_plan mp
    LEFT JOIN recipes r ON r.id = mp.recipe_id`;

const SLOT_ORDER_SQL = `ARRAY['breakfast','lunch','dinner','snack']`;

/** A request that is well-formed but breaks a planner rule (e.g. leftovers before their meal). */
export class PlannerRuleError extends Error {}

export interface MealPlanPatch {
  plannedDate?: string;
  mealType?: string;
  multiplier?: number;
}

export interface LeftoverSlot {
  plannedDate: string;
  mealType: string;
}

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{
    rows: any[];
    rowCount: number | null;
  }>;
};

/** Leftovers must come strictly after the meal that made them. */
async function assertLeftoversAfterSource(
  db: Queryable,
  sourceId: number,
): Promise<void> {
  const violation = await db.query(
    `SELECT 1
       FROM meal_plan l JOIN meal_plan s ON s.id = l.source_entry_id
      WHERE s.id = $1
        AND (l.planned_date, array_position(${SLOT_ORDER_SQL}, l.meal_type))
            <= (s.planned_date, array_position(${SLOT_ORDER_SQL}, s.meal_type))
      LIMIT 1`,
    [sourceId],
  );
  if (violation.rows.length > 0) {
    throw new PlannerRuleError(
      "Leftovers must come after the meal that makes them",
    );
  }
}

@injectable()
export class MealPlanRepository {
  async findByUserId(
    userId: number,
    range?: { start: string; end: string },
  ): Promise<MealPlan[]> {
    const result = range
      ? await pool.query(
          `${SELECT_ENTRY}
            WHERE mp.user_id = $1 AND mp.planned_date BETWEEN $2 AND $3
            ORDER BY mp.planned_date, mp.id`,
          [userId, range.start, range.end],
        )
      : await pool.query(
          `${SELECT_ENTRY} WHERE mp.user_id = $1 ORDER BY mp.planned_date DESC, mp.id`,
          [userId],
        );
    return result.rows;
  }

  /** Entries strictly before a date, newest first, for building past-week history. */
  async findBefore(
    userId: number,
    beforeDate: string,
    limit: number,
  ): Promise<MealPlan[]> {
    const result = await pool.query(
      `${SELECT_ENTRY}
        WHERE mp.user_id = $1 AND mp.planned_date < $2
        ORDER BY mp.planned_date DESC, mp.id
        LIMIT $3`,
      [userId, beforeDate, limit],
    );
    return result.rows;
  }

  async findById(id: number, userId: number): Promise<MealPlan | null> {
    const result = await pool.query(
      `${SELECT_ENTRY} WHERE mp.id = $1 AND mp.user_id = $2`,
      [id, userId],
    );
    return result.rows[0] ?? null;
  }

  /** Leftover cards produced by the given meals, wherever in time they fall. */
  async findLeftoversOf(
    sourceIds: number[],
    userId: number,
  ): Promise<MealPlan[]> {
    if (sourceIds.length === 0) return [];
    const result = await pool.query(
      `${SELECT_ENTRY}
        WHERE mp.user_id = $1 AND mp.source_entry_id = ANY($2)
        ORDER BY mp.planned_date, mp.id`,
      [userId, sourceIds],
    );
    return result.rows;
  }

  /** Returns null when the recipe does not belong to the user. */
  async create(
    entry: Partial<MealPlan> & { multiplier?: number },
  ): Promise<MealPlan | null> {
    const inserted = await pool.query(
      `INSERT INTO meal_plan (user_id, recipe_id, recipe_name, planned_date, meal_type, multiplier)
       SELECT $1, r.id, r.name, $3, $4, $5 FROM recipes r
        WHERE r.id = $2 AND r.user_id = $1
       RETURNING id`,
      [
        entry.userId,
        entry.recipeId,
        entry.plannedDate,
        entry.mealType,
        entry.multiplier ?? 1,
      ],
    );
    if (inserted.rows.length === 0) return null;
    return this.findById(inserted.rows[0].id, entry.userId as number);
  }

  /**
   * Add leftover cards for a planned meal. Returns null when the meal is not
   * the user's (or is itself a leftover); throws PlannerRuleError when a slot
   * is not after the meal.
   */
  async createLeftovers(
    sourceId: number,
    userId: number,
    slots: LeftoverSlot[],
  ): Promise<MealPlan[] | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const source = await client.query(
        `SELECT recipe_id, recipe_name FROM meal_plan
          WHERE id = $1 AND user_id = $2 AND kind = 'meal' FOR UPDATE`,
        [sourceId, userId],
      );
      if (source.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      const ids: number[] = [];
      for (const slot of slots) {
        const inserted = await client.query(
          `INSERT INTO meal_plan
             (user_id, recipe_id, recipe_name, planned_date, meal_type, kind, source_entry_id)
           VALUES ($1, $2, $3, $4, $5, 'leftover', $6) RETURNING id`,
          [
            userId,
            source.rows[0].recipe_id,
            source.rows[0].recipe_name,
            slot.plannedDate,
            slot.mealType,
            sourceId,
          ],
        );
        ids.push(inserted.rows[0].id);
      }
      await assertLeftoversAfterSource(client, sourceId);
      await client.query("COMMIT");
      const created = await pool.query(
        `${SELECT_ENTRY} WHERE mp.id = ANY($1) ORDER BY mp.planned_date, mp.id`,
        [ids],
      );
      return created.rows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Move a card and/or change its multiplier. Moving a meal carries its
   * leftovers by the same number of days; a leftover cannot go before its meal.
   */
  async update(
    id: number,
    userId: number,
    patch: MealPlanPatch,
  ): Promise<MealPlan | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        `SELECT kind, source_entry_id,
                (to_char(planned_date, 'YYYY-MM-DD'))::text AS planned_date
           FROM meal_plan WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, userId],
      );
      if (current.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      const { kind, source_entry_id: sourceId } = current.rows[0];
      if (kind === "leftover" && patch.multiplier !== undefined) {
        throw new PlannerRuleError("Leftovers cannot have a multiplier");
      }

      await client.query(
        `UPDATE meal_plan
            SET planned_date = COALESCE($3, planned_date),
                meal_type = COALESCE($4, meal_type),
                multiplier = COALESCE($5, multiplier),
                updated_at = NOW()
          WHERE id = $1 AND user_id = $2`,
        [
          id,
          userId,
          patch.plannedDate ?? null,
          patch.mealType ?? null,
          patch.multiplier ?? null,
        ],
      );

      if (kind === "meal" && patch.plannedDate) {
        await client.query(
          `UPDATE meal_plan l
              SET planned_date = l.planned_date + (($3)::date - ($4)::date),
                  updated_at = NOW()
            WHERE l.source_entry_id = $1 AND l.user_id = $2`,
          [id, userId, patch.plannedDate, current.rows[0].planned_date],
        );
      }

      await assertLeftoversAfterSource(
        client,
        kind === "leftover" ? sourceId : id,
      );
      await client.query("COMMIT");
      return this.findById(id, userId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: number, userId: number): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM meal_plan WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Check a planned meal off (or back on). Checking off records a completion. */
  async setCooked(
    id: number,
    userId: number,
    cooked: boolean,
  ): Promise<{ entry: MealPlan; completion: CompletionResult | null } | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        `SELECT recipe_id, kind, to_char(planned_date, 'YYYY-MM-DD') AS planned_date
           FROM meal_plan WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, userId],
      );
      if (current.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      const {
        recipe_id: recipeId,
        planned_date: plannedDate,
        kind,
      } = current.rows[0];

      await client.query(
        `UPDATE meal_plan
            SET is_cooked = $3, cooked_date = CASE WHEN $3 THEN NOW() ELSE NULL END,
                updated_at = NOW()
          WHERE id = $1 AND user_id = $2`,
        [id, userId, cooked],
      );

      // Eating leftovers is not cooking: only real meals count toward cook history.
      let completion: CompletionResult | null = null;
      if (recipeId && kind === "meal") {
        if (cooked) {
          completion = await applyCompletion(
            client,
            userId,
            recipeId,
            plannedDate,
            "meal_plan",
            id,
          );
        } else {
          await revokeMealPlanCompletion(client, userId, recipeId, id);
        }
      }
      await client.query("COMMIT");
      const entry = (await this.findById(id, userId)) as MealPlan;
      return { entry, completion };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
