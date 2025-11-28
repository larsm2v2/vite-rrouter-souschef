import express, { Request, Response, NextFunction } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../../database/connection";
import { authenticateJWT } from "../jwtAuth";

console.log("📥 Importing recipes.routes");
const router = express.Router();

// Initialize Google Generative AI
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.warn("WARNING: API_KEY environment variable not found!");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Get all recipes
router.get(
  "/",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(`
      SELECT 
        r.*,
        rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings,
        json_agg(DISTINCT jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients)) FILTER (WHERE ri.category IS NOT NULL) AS ingredients,
        json_agg(jsonb_build_object('step_number', inst.step_number, 'instruction', inst.instruction) ORDER BY inst.step_number) FILTER (WHERE inst.step_number IS NOT NULL) AS instructions,
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

      // Return snake_case format matching frontend interfaces
      const transformedRecipes = result.rows.map((row) => ({
        id: row.id.toString(),
        name: row.name || "",
        unique_id: row.unique_id,
        cuisine: row.cuisine || "",
        meal_type: row.meal_type || "",
        dietary_restrictions: row.dietary_restrictions || [],
        serving_info: {
          prep_time: row.prep_time,
          cook_time: row.cook_time,
          total_time: row.total_time,
          servings: row.servings,
        },
        ingredients: row.ingredients || [],
        instructions: (row.instructions || []).map((inst: any) => ({
          number: inst.step_number,
          text: inst.instruction,
        })),
        notes: row.notes || [],
        nutrition: row.nutrition_data || {},
      }));

      res.json(transformedRecipes);
    } catch (error) {
      next(error);
    }
  }
);

// Get a specific recipe by ID
router.get(
  "/:id",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `
      SELECT 
        r.*,
        rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings,
        json_agg(DISTINCT jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients)) FILTER (WHERE ri.category IS NOT NULL) AS ingredients,
        json_agg(jsonb_build_object('step_number', inst.step_number, 'instruction', inst.instruction) ORDER BY inst.step_number) FILTER (WHERE inst.step_number IS NOT NULL) AS instructions,
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
  }
);

// Generate a recipe with Gemini AI
router.post(
  "/generate",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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

// Save a recipe to the database (delegate to controller)
import "../../../04_factories/di";
import { container } from "tsyringe";
import { RecipeController } from "../../../03_adapters/controllers/RecipeController";

const recipeController = container.resolve(RecipeController);

router.post(
  "/",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await recipeController.create(req, res);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
