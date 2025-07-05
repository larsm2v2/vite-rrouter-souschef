import { Recipe } from "../01_entities";
import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";

export class CreateRecipe {
  constructor(private recipeRepository: RecipeRepository) {}

  /**
   * Clean and validate recipe data
   */
  private cleanRecipe(recipe: Partial<Recipe>): Partial<Recipe> {
    if (!recipe.name) {
      throw new Error("Recipe name is required");
    }

    // Ensure unique ID exists
    if (!recipe.uniqueId) {
      recipe.uniqueId = Date.now();
    }

    // Ensure slug exists
    if (!recipe.slug && recipe.name) {
      recipe.slug = recipe.name.toLowerCase().replace(/\s+/g, "-");
    }

    // Ensure dietary restrictions is an array
    if (!recipe.dietaryRestrictions) {
      recipe.dietaryRestrictions = [];
    }

    // Ensure serving info exists
    if (!recipe.servingInfo) {
      recipe.servingInfo = {
        prepTime: "",
        cookTime: "",
        totalTime: "",
        servings: 0,
      };
    }

    // Ensure ingredients exist
    if (!recipe.ingredients) {
      recipe.ingredients = {};
    } else if (recipe.ingredients) {
      Object.keys(recipe.ingredients).forEach((category) => {
        if (Array.isArray(recipe.ingredients![category])) {
          recipe.ingredients![category] = recipe.ingredients![category].map(
            (item) => ({
              ...item,
              quantity: typeof item.quantity === "number" ? item.quantity : 0,
            })
          );
        } else {
          recipe.ingredients![category] = [];
        }
      });
    }

    // Ensure instructions exist
    if (!recipe.instructions) {
      recipe.instructions = [];
    } else {
      recipe.instructions = recipe.instructions.map((instruction, index) => ({
        ...instruction,
        stepNumber: instruction.stepNumber || index + 1,
      }));
    }

    // Ensure notes is an array
    if (!recipe.notes) {
      recipe.notes = [];
    }

    // Ensure nutrition exists
    if (!recipe.nutrition) {
      recipe.nutrition = {};
    }

    return recipe;
  }

  async execute(recipeData: Partial<Recipe>): Promise<Recipe> {
    const cleanedRecipe = this.cleanRecipe(recipeData);
    return this.recipeRepository.create(cleanedRecipe);
  }
}
