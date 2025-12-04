import pool from "../../05_frameworks/database/connection";
import { AlreadyStocked, StockedItem } from "../../01_entities/AlreadyStocked";
import { injectable } from "tsyringe";

@injectable()
export class AlreadyStockedRepository {
  async getByUser(userId: number): Promise<AlreadyStocked | null> {
    const result = await pool.query(
      `SELECT id, user_id AS "userId", stocked_items AS "stockedItems", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM already_stocked
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async upsert(
    userId: number,
    stockedItems: StockedItem[]
  ): Promise<AlreadyStocked> {
    const result = await pool.query(
      `INSERT INTO already_stocked (user_id, stocked_items, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET stocked_items = $2, updated_at = NOW()
       RETURNING id, user_id AS "userId", stocked_items AS "stockedItems", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [userId, JSON.stringify(stockedItems)]
    );
    return result.rows[0];
  }
}
