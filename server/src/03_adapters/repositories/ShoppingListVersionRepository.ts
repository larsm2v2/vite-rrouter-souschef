import pool from "../../05_frameworks/database/connection";
import { GroceryListVersion } from "../../01_entities/GroceryListVersion";
import { injectable } from "tsyringe";

@injectable()
export class GroceryListVersionRepository {
  async findCurrentByUser(userId: number): Promise<GroceryListVersion | null> {
    const result = await pool.query(
      `SELECT id, user_id AS "userId", version, list_data AS "listData", created_at AS "createdAt", is_current AS "isCurrent"
       FROM shopping_list_versions
       WHERE user_id = $1 AND is_current = true
       LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async createVersion(
    entry: Partial<GroceryListVersion>
  ): Promise<GroceryListVersion> {
    // Mark existing versions as not current
    await pool.query(
      `UPDATE shopping_list_versions SET is_current = false WHERE user_id = $1`,
      [entry.userId]
    );

    const result = await pool.query(
      `INSERT INTO shopping_list_versions (user_id, version, list_data, is_current)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id AS "userId", version, list_data AS "listData", created_at AS "createdAt", is_current AS "isCurrent"`,
      [entry.userId, entry.version, entry.listData, entry.isCurrent ?? true]
    );
    return result.rows[0];
  }
}
