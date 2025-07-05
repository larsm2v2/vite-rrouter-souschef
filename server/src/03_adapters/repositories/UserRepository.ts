import pool from "../../config/database";
import { User } from "../../01_entities/User";

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
}
