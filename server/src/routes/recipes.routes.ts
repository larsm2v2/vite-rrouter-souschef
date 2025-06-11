import express, { Request, Response, NextFunction } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "../config/database";

const router = express.Router();

// Initialize Google Generative AI
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.warn("WARNING: API_KEY environment variable not found!");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Get all recipes
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const result = await pool.query(`
      SELECT 
        r.*,
        rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings,
        json_agg(DISTINCT jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients)) AS ingredients,
        json_agg(DISTINCT jsonb_build_object('step_number', inst.step_number, 'instruction', inst.instruction) ORDER BY inst.step_number) AS instructions,
        json_agg(DISTINCT rn.note) FILTER (WHERE rn.note IS NOT NULL) AS notes,
        rnut.nutrition_data
      FROM recipes r
      LEFT JOIN recipe_serving_info rsi ON r.id = rsi.recipe_id
      LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      LEFT JOIN recipe_instructions inst ON r.id = inst.recipe_id
      LEFT JOIN recipe_notes rn ON r.id = rn.recipe_id
      LEFT JOIN recipe_nutrition rnut ON r.id = rnut.recipe_id
      GROUP BY r.id, rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings, rnut.nutrition_data
      ORDER BY r.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get a specific recipe by ID
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const result = await pool.query(
      `
      SELECT 
        r.*,
        rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings,
        json_agg(DISTINCT jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients)) AS ingredients,
        json_agg(DISTINCT jsonb_build_object('step_number', inst.step_number, 'instruction', inst.instruction) ORDER BY inst.step_number) AS instructions,
        json_agg(DISTINCT rn.note) FILTER (WHERE rn.note IS NOT NULL) AS notes,
        rnut.nutrition_data
      FROM recipes r
      LEFT JOIN recipe_serving_info rsi ON r.id = rsi.recipe_id
      LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      LEFT JOIN recipe_instructions inst ON r.id = inst.recipe_id
      LEFT JOIN recipe_notes rn ON r.id = rn.recipe_id
      LEFT JOIN recipe_nutrition rnut ON r.id = rnut.recipe_id
      WHERE r.id = $1
      GROUP BY r.id, rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings, rnut.nutrition_data
    `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Generate a recipe with Gemini AI
router.post(
  "/generate",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!genAI)
        return res.status(503).json({ error: "AI service not available" });

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const chat = model.startChat({
        history: req.body.history || [],
        generationConfig: {
          temperature: 0.3,
          topP: 0.2,
        },
      });

      const msg = req.body.message;
      const result = await chat.sendMessageStream(msg);
      const response = await result.response;
      const text = response.text();

      res.send(text);
    } catch (error) {
      next(error);
    }
  }
);

// Save a recipe to the database
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query("BEGIN");

    const recipe = req.body;

    // Insert into recipes table
    const recipeResult = await client.query(
      `
      INSERT INTO recipes (
        unique_id, name, slug, cuisine, meal_type, dietary_restrictions
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
      [
        recipe.unique_id || Date.now(),
        recipe.name,
        recipe.id || recipe.name.toLowerCase().replace(/\s+/g, "-"),
        recipe.cuisine,
        recipe.meal_type,
        recipe.dietary_restrictions || [],
      ]
    );

    const recipeId = recipeResult.rows[0].id;

    // Insert serving info
    if (recipe.serving_info) {
      await client.query(
        `
        INSERT INTO recipe_serving_info (
          recipe_id, prep_time, cook_time, total_time, servings
        ) VALUES ($1, $2, $3, $4, $5)
      `,
        [
          recipeId,
          recipe.serving_info.prep_time,
          recipe.serving_info.cook_time,
          recipe.serving_info.total_time,
          recipe.serving_info.number_of_people_served,
        ]
      );
    }

    // Insert ingredients
    if (recipe.ingredients) {
      for (const [category, ingredients] of Object.entries(
        recipe.ingredients
      )) {
        await client.query(
          `
          INSERT INTO recipe_ingredients (
            recipe_id, category, ingredients
          ) VALUES ($1, $2, $3)
        `,
          [recipeId, category, JSON.stringify(ingredients)]
        );
      }
    }

    // Insert instructions
    if (recipe.instructions && Array.isArray(recipe.instructions)) {
      for (const instruction of recipe.instructions) {
        await client.query(
          `
          INSERT INTO recipe_instructions (
            recipe_id, step_number, instruction
          ) VALUES ($1, $2, $3)
        `,
          [
            recipeId,
            instruction.number || instruction.step_number,
            instruction.text || instruction.instruction,
          ]
        );
      }
    }

    // Insert notes
    if (recipe.notes && Array.isArray(recipe.notes)) {
      for (const note of recipe.notes) {
        await client.query(
          `
          INSERT INTO recipe_notes (
            recipe_id, note
          ) VALUES ($1, $2)
        `,
          [recipeId, note]
        );
      }
    }

    // Insert nutrition data
    if (recipe.nutrition) {
      await client.query(
        `
        INSERT INTO recipe_nutrition (
          recipe_id, nutrition_data
        ) VALUES ($1, $2)
      `,
        [recipeId, JSON.stringify(recipe.nutrition)]
      );
    }

    // Commit transaction
    await client.query("COMMIT");

    res.status(201).json({
      id: recipeId,
      message: "Recipe saved successfully",
    });
  } catch (error) {
    // Rollback in case of error
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

export default router;
