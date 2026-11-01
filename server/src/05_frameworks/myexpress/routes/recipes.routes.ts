import express, { Request, Response, NextFunction } from "express";
import { User } from "../../../01_entities/User";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../../database/connection";
import { authenticateJWT } from "../jwtAuth";
import { mergeItems, type GroceryItem } from "../../../utils/groceryMerge";
import { ShoppingListVersionRepository } from "../../../03_adapters/repositories/ShoppingListVersionRepository";
import {
  normalizeApiIngredient,
  scaleIngredient,
} from "../../../utils/recipeMath/ingredient";
import { quantityValue } from "../../../utils/recipeMath/quantity";

console.log("📥 Importing recipes.routes");
const router = express.Router();
const shoppingLists = new ShoppingListVersionRepository();

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
      const result = await db.query(
        `
      SELECT
        r.*,
        rsi.prep_time, rsi.cook_time, rsi.total_time, rsi.servings,
        (
          SELECT json_agg(jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients))
          FROM recipe_ingredients ri
          WHERE ri.recipe_id = r.id
        ) AS ingredients,
        (
          SELECT json_agg(jsonb_build_object('step_number', inst.step_number, 'instruction', inst.instruction) ORDER BY inst.step_number)
          FROM recipe_instructions inst
          WHERE inst.recipe_id = r.id
        ) AS instructions,
        (
          SELECT json_agg(rn.note)
          FROM recipe_notes rn
          WHERE rn.recipe_id = r.id
        ) AS notes,
        rnut.nutrition_data
      FROM recipes r
      LEFT JOIN recipe_serving_info rsi ON r.id = rsi.recipe_id
      LEFT JOIN recipe_nutrition rnut ON r.id = rnut.recipe_id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `,
        [(req.user as User).id],
      );

      // Return snake_case format matching frontend interfaces
      const transformedRecipes = result.rows.map((row) => {
        // Transform ingredients from array to object with category keys
        const ingredientsObj: any = {};
        if (row.ingredients && Array.isArray(row.ingredients)) {
          row.ingredients.forEach((item: any) => {
            if (item.category && item.ingredients) {
              ingredientsObj[item.category] = item.ingredients;
            }
          });
        }

        return {
          id: row.id.toString(),
          name: row.name || "",
          unique_id: row.unique_id,
          cuisine: row.cuisine || "",
          meal_type: row.meal_type || "",
          dietary_restrictions: row.dietary_restrictions || [],
          is_favorite: row.is_favorite || false,
          serving_info: {
            prep_time: row.prep_time,
            cook_time: row.cook_time,
            total_time: row.total_time,
            servings: row.servings,
          },
          ingredients: ingredientsObj,
          instructions: (row.instructions || []).map((inst: any) => ({
            number: inst.step_number,
            text: inst.instruction,
          })),
          notes: row.notes || [],
          nutrition: row.nutrition_data || {},
        };
      });

      res.json(transformedRecipes);
    } catch (error) {
      next(error);
    }
  },
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
        (
          SELECT json_agg(jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients))
          FROM recipe_ingredients ri
          WHERE ri.recipe_id = r.id
        ) AS ingredients,
        (
          SELECT json_agg(jsonb_build_object('step_number', inst.step_number, 'instruction', inst.instruction) ORDER BY inst.step_number)
          FROM recipe_instructions inst
          WHERE inst.recipe_id = r.id
        ) AS instructions,
        (
          SELECT json_agg(rn.note)
          FROM recipe_notes rn
          WHERE rn.recipe_id = r.id
        ) AS notes,
        rnut.nutrition_data
      FROM recipes r
      LEFT JOIN recipe_serving_info rsi ON r.id = rsi.recipe_id
      LEFT JOIN recipe_nutrition rnut ON r.id = rnut.recipe_id
      WHERE r.id = $1 AND r.user_id = $2
    `,
        [req.params.id, (req.user as User).id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      const row = result.rows[0];

      // Transform ingredients from array to object with category keys
      const ingredientsObj: any = {};
      if (row.ingredients && Array.isArray(row.ingredients)) {
        row.ingredients.forEach((item: any) => {
          if (item.category && item.ingredients) {
            ingredientsObj[item.category] = item.ingredients;
          }
        });
      }

      const transformedRecipe = {
        id: row.id.toString(),
        name: row.name || "",
        unique_id: row.unique_id,
        cuisine: row.cuisine || "",
        meal_type: row.meal_type || "",
        dietary_restrictions: row.dietary_restrictions || [],
        is_favorite: row.is_favorite || false,
        serving_info: {
          prep_time: row.prep_time,
          cook_time: row.cook_time,
          total_time: row.total_time,
          servings: row.servings,
        },
        ingredients: ingredientsObj,
        instructions: (row.instructions || []).map((inst: any) => ({
          number: inst.step_number,
          text: inst.instruction,
        })),
        notes: row.notes || [],
        nutrition: row.nutrition_data || {},
      };

      res.json(transformedRecipe);
    } catch (error) {
      next(error);
    }
  },
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
  },
);

// Save a recipe to the database (delegate to controller)
import "../../../04_factories/di";
import { container } from "tsyringe";
import { RecipeController } from "../../../03_adapters/controllers/RecipeController";
import { RecipeImportController } from "../../../03_adapters/controllers/RecipeImportController";
import { asyncHandler } from "../utils/asyncHandler";
import { recipeImportLimiter, shareTokenLimiter } from "../gateway";

const recipeController = container.resolve(RecipeController);
const recipeImportController = container.resolve(RecipeImportController);

router.post(
  "/",
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    await recipeController.create(req, res);
  }),
);

router.post(
  "/import-url",
  authenticateJWT,
  recipeImportLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    await recipeImportController.importUrl(req, res);
  }),
);

// Toggle favorite status for a recipe
router.patch(
  "/:id/favorite",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const recipeId = parseInt(req.params.id);
      const userId = (req.user as User).id;

      // Get current favorite status
      const currentStatus = await db.query(
        `SELECT is_favorite FROM recipes WHERE id = $1 AND user_id = $2`,
        [recipeId, userId],
      );

      if (currentStatus.rows.length === 0) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      // Toggle the favorite status
      const newFavoriteStatus = !currentStatus.rows[0].is_favorite;

      await db.query(
        `UPDATE recipes SET is_favorite = $1 WHERE id = $2 AND user_id = $3`,
        [newFavoriteStatus, recipeId, userId],
      );

      res.json({ isFavorite: newFavoriteStatus });
    } catch (error) {
      next(error);
    }
  },
);

// Add all recipe ingredients to grocery list
router.post(
  "/:id/add-to-grocery-list",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const recipeId = parseInt(req.params.id);
      const userId = (req.user as User).id;

      let scale = 1;
      if (req.body?.scale !== undefined) {
        const requested = req.body.scale;
        if (
          typeof requested !== "number" ||
          !Number.isFinite(requested) ||
          requested < 0.25 ||
          requested > 20
        ) {
          return res
            .status(400)
            .json({ error: "scale must be a number between 0.25 and 20" });
        }
        scale = requested;
      }
      const recipeResult = await db.query(
        `
        SELECT
          (
            SELECT json_agg(jsonb_build_object('category', ri.category, 'ingredients', ri.ingredients))
            FROM recipe_ingredients ri
            WHERE ri.recipe_id = r.id
          ) AS ingredients
        FROM recipes r
        WHERE r.id = $1 AND r.user_id = $2
      `,
        [recipeId, userId],
      );

      if (recipeResult.rows.length === 0) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      const ingredients = recipeResult.rows[0].ingredients;
      if (!ingredients || ingredients.length === 0) {
        return res
          .status(400)
          .json({ error: "Recipe has no ingredients to add" });
      }

      // Normalize every ingredient (string or structured), scale it, and merge with the shared rules
      const newItems: GroceryItem[] = [];
      ingredients.forEach((categoryObj: any) => {
        if (!categoryObj.ingredients || !Array.isArray(categoryObj.ingredients))
          return;
        categoryObj.ingredients.forEach((entry: any) => {
          const scaled = scaleIngredient(normalizeApiIngredient(entry), scale);
          const name = (scaled.name || scaled.raw).trim();
          if (!name) return;
          newItems.push({
            name,
            quantity:
              scaled.quantity === null ? 0 : quantityValue(scaled.quantity),
            unit: scaled.unit ?? "",
            checked: false,
            sources: [String(recipeId)],
          });
        });
      });

      // Read, merge and write under the per-user lock so a concurrent autosave cannot be lost
      const saved = await shoppingLists.saveVersion(userId, (current) =>
        mergeItems(current as GroceryItem[], newItems),
      );

      res.json({
        success: true,
        itemsAdded: newItems.length,
        totalItems: Array.isArray(saved.listData) ? saved.listData.length : 0,
        version: saved.version,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Generate (or reuse) a share link for a recipe. Owner-only.
router.post(
  "/:id/share",
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    await recipeController.shareRecipe(req, res);
  }),
);

// Read-only preview of a shared recipe by its share token. Rate limited to
// blunt token brute-forcing.
router.get(
  "/shared/:token",
  authenticateJWT,
  shareTokenLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    await recipeController.getSharedRecipe(req, res);
  }),
);

// Copy a shared recipe into the current user's own recipes. Rate limited to
// blunt token brute-forcing.
router.post(
  "/shared/:token/accept",
  authenticateJWT,
  shareTokenLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    await recipeController.acceptSharedRecipe(req, res);
  }),
);

export default router;
