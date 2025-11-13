import pool from "../../05_frameworks/database/connection";
import { MealPlan } from "../../01_entities/MealPlan";
import { injectable } from "tsyringe";

@injectable()
export class MealPlanRepository {
  async findByUserId(userId: number): Promise<MealPlan[]> {
    const result = await pool.query(
      `SELECT id, user_id AS "userId", recipe_id AS "recipeId", planned_date AS "plannedDate",
              meal_type AS "mealType", is_cooked AS "isCooked", cooked_date AS "cookedDate",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM meal_plan
       WHERE user_id = $1
       ORDER BY planned_date DESC`,
      [userId]
    );
    return result.rows;
  }

  async create(entry: Partial<MealPlan>): Promise<MealPlan> {
    const result = await pool.query(
      `INSERT INTO meal_plan (user_id, recipe_id, planned_date, meal_type, is_cooked, cooked_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id AS "userId", recipe_id AS "recipeId", planned_date AS "plannedDate",
                 meal_type AS "mealType", is_cooked AS "isCooked", cooked_date AS "cookedDate",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        entry.userId,
        entry.recipeId,
        entry.plannedDate,
        entry.mealType,
        entry.isCooked || false,
        entry.cookedDate,
      ]
    );
    return result.rows[0];
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query(`DELETE FROM meal_plan WHERE id = $1`, [
      id,
    ]);
    return (result.rowCount ?? 0) > 0;
  }
}
