import { Recipe } from "../../01_entities";

describe("Recipe Entity", () => {
  it("should create a valid recipe object", () => {
    const recipe: Recipe = {
      id: 1,
      userId: 1,
      uniqueId: 12345678,
      name: "Some Great Recipe",
      slug: "some-great-recipe",
      cuisine: "Cuisine",
      mealType: "Breakfast",
      dietaryRestrictions: [],
      servingInfo: {
        prepTime: "10 minutes",
        cookTime: "20 minutes",
        totalTime: "30 minutes",
        servings: 4,
      },
      ingredients: {
        Main: [
          { name: "Eggs", quantity: 2, unit: "pieces" },
          { name: "Milk", quantity: 1, unit: "cup" },
        ],
      },
      instructions: [
        { stepNumber: 1, instruction: "Beat the eggs." },
        { stepNumber: 2, instruction: "Add milk and mix well." },
      ],
      notes: ["Serve immediately for best taste."],
      nutrition: {
        calories: "200 kcal",
        protein: "10 g",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(recipe.id).toBe(1);
    expect(recipe.userId).toBe(1);
    expect(recipe.uniqueId).toBe(12345678);
    expect(recipe.name).toBe("Some Great Recipe");
    expect(recipe.slug).toBe("some-great-recipe");
    expect(recipe.cuisine).toBe("Cuisine");
    expect(recipe.mealType).toBe("Breakfast");
    expect(recipe.dietaryRestrictions).toEqual([]);
    expect(recipe.servingInfo).toEqual({
      prepTime: "10 minutes",
      cookTime: "20 minutes",
      totalTime: "30 minutes",
      servings: 4,
    });
    expect(recipe.ingredients).toEqual({
      Main: [
        { name: "Eggs", quantity: 2, unit: "pieces" },
        { name: "Milk", quantity: 1, unit: "cup" },
      ],
    });
    expect(recipe.instructions).toEqual([
      { stepNumber: 1, instruction: "Beat the eggs." },
      { stepNumber: 2, instruction: "Add milk and mix well." },
    ]);
    expect(recipe.notes).toEqual(["Serve immediately for best taste."]);
    expect(recipe.nutrition).toEqual({
      calories: "200 kcal",
      protein: "10 g",
    });
    expect(recipe.createdAt).toBeInstanceOf(Date);
    expect(recipe.updatedAt).toBeInstanceOf(Date);
  });
  it("should handle optional fields correctly", () => {
    const recipe: Recipe = {
      id: 2,
      userId: 1,
      uniqueId: 98765432,
      name: "Optional Recipe",
      slug: "optional-recipe",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(recipe.id).toBe(2);
    expect(recipe.userId).toBe(1);
    expect(recipe.uniqueId).toBe(98765432);
    expect(recipe.name).toBe("Optional Recipe");
    expect(recipe.slug).toBe("optional-recipe");
    expect(recipe.cuisine).toBeUndefined();
    expect(recipe.mealType).toBeUndefined();
    expect(recipe.dietaryRestrictions).toBeUndefined();
    expect(recipe.servingInfo).toBeUndefined();
    expect(recipe.ingredients).toBeUndefined();
    expect(recipe.instructions).toBeUndefined();
    expect(recipe.notes).toBeUndefined();
    expect(recipe.nutrition).toBeUndefined();
    expect(recipe.createdAt).toBeInstanceOf(Date);
    expect(recipe.updatedAt).toBeInstanceOf(Date);
  });
});
