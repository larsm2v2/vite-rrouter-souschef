import pool from "../../05_frameworks/database/connection";
import { injectable } from "tsyringe";
import { MEAL_TYPES, type MealType } from "../../utils/mealPlanWeeks";

export interface PlannerSettings {
  weekStartDay: number;
  favoriteThreshold: number;
  visibleSlots: MealType[];
  householdSize: number;
}

const DEFAULTS: PlannerSettings = {
  weekStartDay: 1,
  favoriteThreshold: 3,
  visibleSlots: ["dinner"],
  householdSize: 2,
};

const SELECT = `week_start_day AS "weekStartDay", favorite_threshold AS "favoriteThreshold",
                planner_slots AS "visibleSlots", household_size AS "householdSize"`;

/** Keep slots in day order (breakfast..snack) regardless of how they were submitted. */
export function orderSlots(slots: readonly string[]): MealType[] {
  return MEAL_TYPES.filter((slot) => slots.includes(slot));
}

@injectable()
export class PlannerSettingsRepository {
  async get(userId: number): Promise<PlannerSettings> {
    const result = await pool.query(`SELECT ${SELECT} FROM users WHERE id = $1`, [
      userId,
    ]);
    return result.rows[0] ?? DEFAULTS;
  }

  /**
   * Save settings. Lowering the threshold retroactively favorites recipes that
   * already qualify, except ones the user manually unfavorited.
   */
  async update(
    userId: number,
    patch: Partial<PlannerSettings>,
  ): Promise<PlannerSettings> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE users
            SET week_start_day = COALESCE($2, week_start_day),
                favorite_threshold = COALESCE($3, favorite_threshold),
                planner_slots = COALESCE($4, planner_slots),
                household_size = COALESCE($5, household_size)
          WHERE id = $1
          RETURNING ${SELECT}`,
        [
          userId,
          patch.weekStartDay ?? null,
          patch.favoriteThreshold ?? null,
          patch.visibleSlots ?? null,
          patch.householdSize ?? null,
        ],
      );
      const settings: PlannerSettings = result.rows[0];
      if (settings && settings.favoriteThreshold > 0) {
        await client.query(
          `UPDATE recipes SET is_favorite = true
            WHERE user_id = $1 AND NOT is_favorite AND NOT favorite_locked
              AND cook_count >= $2`,
          [userId, settings.favoriteThreshold],
        );
      }
      await client.query("COMMIT");
      return settings;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
