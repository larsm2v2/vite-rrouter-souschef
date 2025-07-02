import express, { Request, Response, NextFunction } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "../config/database";

const router = express.Router();

router.get("/user/:userId/grocery-list", async (req, res, next) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `
      SELECT * FROM grocery_list WHERE user_id = $1
    `,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
