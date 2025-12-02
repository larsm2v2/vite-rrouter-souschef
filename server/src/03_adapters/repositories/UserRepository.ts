import pool from "../../05_frameworks/database/connection";
import { User } from "../../01_entities/User";
import { injectable } from "tsyringe";

@injectable()
export class UserRepository {
  async findById(userId: number): Promise<User | null> {
    const result = await pool.query(
      "SELECT id, email, display_name, avatar FROM users WHERE id = $1",
      [userId]
    );
    return result.rows[0] || null;
  }

  async create(user: Partial<User>): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (google_sub, email, display_name, avatar)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, avatar`,
      [user.googleSub, user.email, user.displayName, user.avatar]
    );
    return result.rows[0];
  }

  async update(userId: number, update: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

      if (typeof update.displayName !== "undefined") {
        fields.push(`display_name = $${idx++}`);
        values.push(update.displayName);
    }
    if (typeof update.avatar !== "undefined") {
      fields.push(`avatar = $${idx++}`);
      values.push(update.avatar);
    }
    if (fields.length === 0) return this.findById(userId);

    const sql = `UPDATE users SET ${fields.join(
      ", "
    )} WHERE id = $${idx} RETURNING id, email, display_name, avatar`;
    values.push(userId);
    const result = await pool.query(sql, values);
    return result.rows[0] || null;
  }
}
