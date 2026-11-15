import { parseRecipeText } from "../utils/parseRecipeText";
import { normalizeIngredients } from "../utils/normalizeIngredients";

describe("parseRecipeText", () => {
  it("splits a headed recipe into name, ingredients, steps and serving info", () => {
    const parsed = parseRecipeText(
      [
        "Simple Pancakes",
        "Serves 4",
        "Prep time: 10 min",
        "Cook: 15 minutes",
        "Ingredients",
        "- 1 1/2 cups flour",
        "• 1 egg",
        "Instructions",
        "1. Mix dry ingredients.",
        "2) Whisk in milk and egg.",
        "Notes",
        "Great with syrup",
      ].join("\n"),
    );

    expect(parsed.name).toBe("Simple Pancakes");
    expect(parsed.ingredients.default).toEqual(["1 1/2 cups flour", "1 egg"]);
    expect(parsed.instructions).toEqual([
      { number: 1, text: "Mix dry ingredients." },
      { number: 2, text: "Whisk in milk and egg." },
    ]);
    expect(parsed.notes).toEqual(["Great with syrup"]);
    expect(parsed.servingInfo).toEqual({
      servings: 4,
      prepTime: "10 min",
      cookTime: "15 minutes",
    });
  });

  it("classifies lines without headings by shape", () => {
    const parsed = parseRecipeText(
      "Toast\n2 slices bread\n1 tbsp butter\nToast the bread and spread the butter on it.",
    );

    expect(parsed.name).toBe("Toast");
    expect(parsed.ingredients.default).toEqual(["2 slices bread", "1 tbsp butter"]);
    expect(parsed.instructions).toHaveLength(1);
  });

  it("groups ingredients under sub-headings", () => {
    const parsed = parseRecipeText(
      "Ingredients\nFor the sauce:\n1 cup tomatoes\nFor the pasta:\n200 g spaghetti",
    );

    expect(Object.keys(parsed.ingredients)).toEqual(["sauce", "pasta"]);
  });
});

describe("normalizeIngredients", () => {
  it("converts text lines to ingredient objects and keeps objects", () => {
    const result = normalizeIngredients({
      default: [
        "1 cup rice",
        "salt to taste",
        "  ",
        { id: 9, name: "oil", quantity: 2, unit: "tbsp" },
      ],
    }) as any;

    expect(result.default).toEqual([
      { id: 1, name: "rice", quantity: 1, unit: "cup" },
      { id: 2, name: "salt to taste", quantity: 0, unit: "" },
      { id: 9, name: "oil", quantity: 2, unit: "tbsp" },
    ]);
  });

  it("passes through missing ingredients", () => {
    expect(normalizeIngredients(undefined)).toBeUndefined();
  });
});
