import pool from "../../05_frameworks/database/connection";
import { RecipeActivityLog } from "../../01_entities/RecipeActivityLog";
import { injectable } from "tsyringe";

@injectable()
export class RecipeActivityLogRepository {
  async logActivity(
    entry: Partial<RecipeActivityLog>
  ): Promise<RecipeActivityLog> {
    const result = await pool.query(
      `INSERT INTO recipe_activity_log (user_id, recipe_id, activity_type, activity_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id AS "userId", recipe_id AS "recipeId", activity_type AS "activityType", activity_data AS "activityData", created_at AS "createdAt"`,
      [entry.userId, entry.recipeId, entry.activityType, entry.activityData]
    );
    return result.rows[0];
  }

  async findByUser(userId: number): Promise<RecipeActivityLog[]> {
    const result = await pool.query(
      `SELECT id, user_id AS "userId", recipe_id AS "recipeId", activity_type AS "activityType", activity_data AS "activityData", created_at AS "createdAt"
       FROM recipe_activity_log
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }
}
