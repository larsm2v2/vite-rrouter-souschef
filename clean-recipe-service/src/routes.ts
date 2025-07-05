import express from "express";
import { cleanRecipe } from "./cleanRecipe";

const router = express.Router();

router.post("/clean-recipe", (req, res) => {
  try {
    const cleanedRecipe = cleanRecipe(req.body);
    res.status(200).json(cleanedRecipe);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
