import pool from "../../05_frameworks/database/connection";
import { AlreadyStocked, StockedItem } from "../../01_entities/AlreadyStocked";
import { sanitizeStaples } from "../../utils/staples";
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

  /**
   * Merge items into the user's staples under a row lock so concurrent
   * one-tap adds from different screens cannot overwrite each other.
   */
  async addItems(
    userId: number,
    items: StockedItem[]
  ): Promise<AlreadyStocked> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO already_stocked (user_id, stocked_items) VALUES ($1, '[]'::jsonb)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      const current = await client.query(
        `SELECT stocked_items FROM already_stocked WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );
      const merged = sanitizeStaples([
        ...(current.rows[0].stocked_items as StockedItem[]),
        ...items,
      ]) as StockedItem[];
      const result = await client.query(
        `UPDATE already_stocked SET stocked_items = $2, updated_at = NOW()
         WHERE user_id = $1
         RETURNING id, user_id AS "userId", stocked_items AS "stockedItems", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [userId, JSON.stringify(merged)]
      );
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
