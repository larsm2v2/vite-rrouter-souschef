import pool from "../../05_frameworks/database/connection";
import { ShoppingListVersion } from "../../01_entities/ShoppingListVersion";
import { injectable } from "tsyringe";

const COLUMNS = `id, user_id AS "userId", version, list_data AS "listData", created_at AS "createdAt", is_current AS "isCurrent"`;

/** Thrown when a save was based on a version that is no longer current. */
export class VersionConflictError extends Error {
  constructor(public current: ShoppingListVersion | null) {
    super("Grocery list changed since it was loaded");
    this.name = "VersionConflictError";
  }
}

type Updater = (current: unknown[]) => unknown[];

@injectable()
export class ShoppingListVersionRepository {
  async findCurrentByUser(userId: number): Promise<ShoppingListVersion | null> {
    const result = await pool.query(
      `SELECT ${COLUMNS}
       FROM shopping_list_versions
       WHERE user_id = $1 AND is_current = true
       ORDER BY id DESC
       LIMIT 1`,
      [userId],
    );
    return result.rows[0] || null;
  }

  /**
   * Write a new current version for one user. Writers for the same user are serialized with an
   * advisory lock, so a concurrent autosave and add-recipe cannot interleave. When baseVersion is
   * given it must equal the current version, otherwise nothing is written and a conflict is thrown.
   * The updater receives the current list and returns the list to store.
   */
  async saveVersion(
    userId: number,
    update: Updater,
    baseVersion?: number,
  ): Promise<ShoppingListVersion> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [userId]);

      const currentResult = await client.query(
        `SELECT ${COLUMNS} FROM shopping_list_versions
         WHERE user_id = $1 AND is_current = true
         ORDER BY id DESC LIMIT 1`,
        [userId],
      );
      const current: ShoppingListVersion | null = currentResult.rows[0] || null;

      if (
        baseVersion !== undefined &&
        (current?.version ?? 0) !== baseVersion
      ) {
        await client.query("ROLLBACK");
        throw new VersionConflictError(current);
      }

      const nextList = update(
        Array.isArray(current?.listData) ? current!.listData : [],
      );

      await client.query(
        `UPDATE shopping_list_versions SET is_current = false WHERE user_id = $1`,
        [userId],
      );
      const inserted = await client.query(
        `INSERT INTO shopping_list_versions (user_id, version, list_data, is_current)
         VALUES (
           $1,
           (SELECT COALESCE(MAX(version), 0) + 1 FROM shopping_list_versions WHERE user_id = $1),
           $2::jsonb,
           true
         )
         RETURNING ${COLUMNS}`,
        [userId, JSON.stringify(nextList)],
      );
      await client.query("COMMIT");
      return inserted.rows[0];
    } catch (error) {
      if (!(error instanceof VersionConflictError)) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // connection already aborted
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
