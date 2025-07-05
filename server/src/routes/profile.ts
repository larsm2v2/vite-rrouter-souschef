import express, { Request, Response } from "express";
import pool from "../config/database";

const router = express.Router();

router.get("/profile", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = (req.user as any).id;
  try {
    const result = await pool.query(
      `SELECT id, email, display_name, avatar 
       FROM users 
       WHERE id = $1`,
      [userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error retrieving profile:", err);
    res.status(500).json({ error: "Failed to retrieve profile" });
  }
});

export default router;
