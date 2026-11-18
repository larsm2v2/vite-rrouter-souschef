import { describe, expect, it } from "vitest";
import { ingredientName, toIngredientGroups } from "./recipeIngredients";

const nameOf = (line: string | { name?: string }) =>
  ingredientName(
    toIngredientGroups({ default: [line] })[0].items[0].ingredient,
  );

describe("ingredientName", () => {
  it("drops quantity, unit and prep notes", () => {
    expect(nameOf("2 cups all-purpose flour, sifted")).toBe(
      "all-purpose flour",
    );
    expect(nameOf("1 (14 oz) can diced tomatoes")).toBe("diced tomatoes");
  });

  it("uses a structured ingredient's name", () => {
    expect(nameOf({ name: "olive oil" })).toBe("olive oil");
  });

  it("falls back to the raw line when no name can be parsed", () => {
    expect(nameOf("3 cups")).toBe("3 cups");
  });
});
