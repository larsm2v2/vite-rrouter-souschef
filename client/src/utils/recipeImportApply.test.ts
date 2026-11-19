import { describe, expect, it } from "vitest";
import type { ParsedRecipe } from "../components/common/ParsedRecipeEditor";
import {
  applySections,
  availableSections,
  isoDurationToText,
} from "./recipeImportApply";

const saved: ParsedRecipe = {
  name: "Old Soup",
  cuisine: "French",
  mealType: "dinner",
  dietaryRestrictions: ["vegetarian"],
  servingInfo: { prepTime: "5 min", cookTime: "20 min", servings: 2 },
  ingredients: { default: ["1 cup flour"] },
  instructions: [{ number: 1, text: "Old step" }],
  notes: ["My own note"],
};

const fetched: ParsedRecipe = {
  name: " New Soup ",
  cuisine: "",
  ingredients: { default: ["2 leeks", "salt"], sauce: [] },
  instructions: [
    { number: 7, text: "Chop." },
    { number: 9, text: "  " },
    { number: 12, text: "Simmer." },
  ],
  notes: ["From the page"],
  servingInfo: { prepTime: "PT15M", servings: 4 },
};

describe("isoDurationToText", () => {
  it("humanizes ISO durations and leaves other text alone", () => {
    expect(isoDurationToText("PT15M")).toBe("15 min");
    expect(isoDurationToText("PT1H30M")).toBe("1 hr 30 min");
    expect(isoDurationToText("P1DT2H")).toBe("1 day 2 hr");
    expect(isoDurationToText("PT45S")).toBe("45 sec");
    expect(isoDurationToText("about 20 minutes")).toBe("about 20 minutes");
    expect(isoDurationToText("PT0M")).toBe("PT0M");
  });
});

describe("availableSections", () => {
  it("lists only what the page provided", () => {
    expect(availableSections(fetched)).toEqual([
      "details",
      "ingredients",
      "instructions",
      "notes",
    ]);
    expect(
      availableSections({
        ingredients: { default: [] },
        instructions: [],
        notes: [],
      }),
    ).toEqual([]);
  });
});

describe("applySections", () => {
  it("merges details field by field and keeps saved values the page lacks", () => {
    const next = applySections(saved, fetched, ["details"]);
    expect(next.name).toBe("New Soup");
    expect(next.cuisine).toBe("French"); // blank on the page, so unchanged
    expect(next.servingInfo).toEqual({
      prepTime: "15 min",
      cookTime: "20 min", // not on the page, so kept
      servings: 4,
    });
    expect(next.ingredients).toEqual(saved.ingredients);
    expect(next.notes).toEqual(saved.notes);
  });

  it("replaces ingredients and renumbers instructions, dropping blanks and empty groups", () => {
    const next = applySections(saved, fetched, ["ingredients", "instructions"]);
    expect(next.ingredients).toEqual({ default: ["2 leeks", "salt"] });
    expect(next.instructions).toEqual([
      { number: 1, text: "Chop." },
      { number: 2, text: "Simmer." },
    ]);
    expect(next.name).toBe("Old Soup");
  });

  it("only touches notes when asked, and never empties a section the page lacks", () => {
    expect(applySections(saved, fetched, ["details"]).notes).toEqual([
      "My own note",
    ]);
    expect(applySections(saved, fetched, ["notes"]).notes).toEqual([
      "From the page",
    ]);
    const bare: ParsedRecipe = { ingredients: {}, instructions: [], notes: [] };
    expect(
      applySections(saved, bare, ["ingredients", "instructions", "notes"]),
    ).toEqual(saved);
  });

  it("does not mutate the draft", () => {
    const before = JSON.stringify(saved);
    applySections(saved, fetched, ["details", "ingredients", "instructions", "notes"]);
    expect(JSON.stringify(saved)).toBe(before);
  });
});
