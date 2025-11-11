import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { cleanRecipe, cleanedRecipeData } from "./cleanRecipeData";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RecipeModel } from "./Models";

import { AppDataSource } from "./database";
import { Recipe } from "./entity/Recipe.entity";
import { IngredientCategory } from "./entity/Recipe.entity";
import { InstructionStep } from "./entity/Recipe.entity";
import { IngredientItem } from "./entity/Recipe.entity";
// Load environment variables from .env file

dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();
app.use(
  cors({
    origin: "http://localhost:5173", // Allow requests from this origin
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
express.response;

//API key for Google Generative AI
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not found!");
}
const genAI = new GoogleGenerativeAI(apiKey);

const recipeFilePath = path.join(__dirname, "Recipes.json");
const synonymFilePath = path.join(__dirname, "IngredientSynonyms.json");
let activeSSEConnections: Response[] = [];

// Error Handling Middleware
app.use(
  (
    err: any, // Define `err` to accept any type of error
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    console.error("Error in request handling:", err);
    if (err.code === "ENOENT") {
      // Specific handling for file not found
      res.status(404).json({ error: "File not found" });
    } else if (err instanceof SyntaxError && err.message.includes("JSON")) {
      // Specific handling for JSON parsing errors
      res.status(400).json({ error: "Invalid JSON data" });
    } else {
      // Generic error handling
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);
// Initialize database connection
AppDataSource.initialize()
  .then(() => {
    console.log("Database connected");
  })
  .catch((error: Error) => console.log(error));

//API for getting recipe data
app.get(
  "/api/recipes",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const recipeRepository = AppDataSource.getRepository(Recipe);
      const recipes = await recipeRepository.find({
        relations: [
          "ingredientCategories",
          "ingredientCategories.items",
          "instructions",
        ],
      });
      res.status(200).json(recipes);
    } catch (error) {
      next(error);
    }
  }
);
//API for getting ingredient synonyms
app.get(
  "/api/ingredient-synonyms",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Read recipe data
      let synonyms;
      synonyms = await fsPromises.readFile(synonymFilePath, "utf-8");
      res.status(200).json({
        message: "Recipe data fixed successfully.",
        data: synonyms,
      });
    } catch (error) {
      next(error);
    }
  }
);

//Gemini API
app.post(
  "/api/gemini",
  async (req: Request, res: Response, next: NextFunction) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const chat = model.startChat({
      history: req.body.history,
      generationConfig: {
        /* maxOutputTokens: 100, */
        temperature: 0.3,
        topP: 0.2,
      },
    });
    const msg = req.body.message;
    const result = await chat.sendMessageStream(msg);
    const response = await result.response;
    const text = response.text();
    res.send(text);
  }
);
//API for cleaning recipe data
app.post(
  "/api/clean-recipe",
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const recipe: RecipeModel = req.body; // Type assertion to RecipeModel
      const cleanedRecipe = cleanRecipe(recipe);
      res.status(200).json(cleanedRecipe);
    } catch (error) {
      next(error);
    }
  }
);
//API for cleaning recipe data
app.post(
  "/api/clean-recipes",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Read recipe data
      let rawData;

      rawData = await fsPromises.readFile(recipeFilePath, "utf-8");
      const recipeData: any[] = JSON.parse(rawData);

      // 2. Fix the recipe data
      const cleanedRecipes: RecipeModel[] = cleanedRecipeData(recipeData);
      console.log("Recipes.json path:", recipeFilePath);

      // 3. Write cleaned data back to file
      await fsPromises.writeFile(
        recipeFilePath,
        JSON.stringify(cleanedRecipes, null, 2)
      );

      // 4. Send success response
      res.status(200).json({
        message: "Recipe data fixed successfully.",
        data: cleanedRecipes,
      });
    } catch (error) {
      next(error);
    }
  }
);
//API for cleaning and appending recipe data to JSON
// API for cleaning and adding recipe data
app.post(
  "/api/clean-and-add-recipes",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const recipeRepository = AppDataSource.getRepository(Recipe);
      const rawRecipe = req.body;

      // Transform the recipe to match our entity structure
      const newRecipe = new Recipe();
      newRecipe.name = rawRecipe.name;
      newRecipe.uniqueId = rawRecipe["unique id"].toString();
      newRecipe.cuisine = rawRecipe.cuisine;
      newRecipe.mealType = rawRecipe["meal type"];
      newRecipe.dietaryRestrictions =
        rawRecipe["dietary restrictions and designations"] || [];
      newRecipe.servingInfo = rawRecipe["serving info"];
      newRecipe.notes = rawRecipe.notes || [];
      newRecipe.nutrition = rawRecipe.nutrition;
      newRecipe.groceryList = rawRecipe.groceryList;

      // Process ingredients
      newRecipe.ingredientCategories = Object.entries(
        rawRecipe.ingredients
      ).map(([categoryName, items]: [string, any]) => {
        const category = new IngredientCategory();
        category.name = categoryName;
        category.items = items.map((item: any) => {
          const ingredientItem = new IngredientItem();
          ingredientItem.name = item.name;
          ingredientItem.quantity = parseQuantity(item.quantity);
          ingredientItem.unit = item.unit;
          return ingredientItem;
        });
        return category;
      });

      // Process instructions
      newRecipe.instructions = rawRecipe.instructions.map(
        (instruction: any, index: number) => {
          const step = new InstructionStep();
          step.number = instruction.number || index + 1;
          step.text = instruction.text;
          return step;
        }
      );

      // Save the recipe
      await recipeRepository.save(newRecipe);

      res.status(201).json({
        message: "Recipe added successfully",
        data: newRecipe,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
