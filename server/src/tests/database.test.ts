// tests/database.test.ts
process.env.NODE_ENV = "test";

import pool from "../config/database";
import { User, GameStats } from "../types/entities/User";
import { initializeDatabase } from "../config/schema";

describe("Database Operations", () => {
  let userId: number;

  beforeAll(async () => {
    // Initialize database tables
    await initializeDatabase();
    
    // Seed the database with a test user
    const result = await pool.query(
      `INSERT INTO users (google_sub, display_name, email) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ["test-google-id", "Test User", "test@example.com"]
    );
    userId = result.rows[0].id; // Store the user ID for later use
  });

  afterAll(async () => {
    // Clean up the database after tests
    await pool.query("DELETE FROM game_stats");
    await pool.query("DELETE FROM users");
    await pool.end(); // Close the connection pool
  });

  it("should retrieve a user by google_sub", async () => {
    const result = await pool.query<User>(
      "SELECT * FROM users WHERE google_sub = $1",
      ["test-google-id"]
    );
    const user = result.rows[0];

    expect(user).toBeDefined();
    expect(user.display_name).toBe("Test User");
    expect(user.email).toBe("test@example.com");
  });

  it("should create a new user", async () => {
    const result = await pool.query<User>(
      `INSERT INTO users (google_sub, display_name, email) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      ["new-google-id", "New User", "new@example.com"]
    );
    const user = result.rows[0];

    expect(user).toBeDefined();
    expect(user.email).toBe("new@example.com");
  });

  it("should insert and retrieve game stats for a user", async () => {
    const buttons_pressed = ["button1", "button2"];
    const saved_maps = ["map1", "map2"];

    // Insert with proper JSON conversion
    const insertResult = await pool.query(
      `INSERT INTO game_stats 
       (user_id, current_level, buttons_pressed, saved_maps) 
       VALUES ($1, $2, $3::jsonb, $4::jsonb) 
       RETURNING *`,
      [userId, 5, JSON.stringify(buttons_pressed), JSON.stringify(saved_maps)]
    );

    // Query to verify
    const verifyResult = await pool.query(
      `SELECT * FROM game_stats WHERE user_id = $1`,
      [userId]
    );

    const gameStats = verifyResult.rows[0];
    expect(gameStats.user_id).toBe(userId);
    expect(gameStats.current_level).toBe(5);

    // Compare JSONB data directly
    expect(gameStats.buttons_pressed).toEqual(buttons_pressed);
    expect(gameStats.saved_maps).toEqual(saved_maps);
  });
});
