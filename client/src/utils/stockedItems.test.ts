import { describe, expect, it } from "vitest";
import {
  categoryOptions,
  groceryAddedMessage,
  groupByCategory,
  hasStockedName,
} from "./stockedItems";

describe("groupByCategory", () => {
  it("sorts categories A-Z, merges case variants, and puts uncategorized last", () => {
    const groups = groupByCategory([
      { name: "salt" },
      { name: "paprika", category: "Spices" },
      { name: "flour", category: "baking" },
      { name: "cumin", category: " spices " },
      { name: "sugar", category: "Baking" },
      { name: "olive oil", category: "" },
    ]);
    expect(groups.map((g) => g.category)).toEqual(["baking", "Spices", null]);
    expect(groups[0].items.map((i) => i.name)).toEqual(["flour", "sugar"]);
    expect(groups[1].items.map((i) => i.name)).toEqual(["paprika", "cumin"]);
    expect(groups[2].items.map((i) => i.name)).toEqual(["salt", "olive oil"]);
  });

  it("returns no groups for an empty list", () => {
    expect(groupByCategory([])).toEqual([]);
  });
});

describe("categoryOptions", () => {
  it("de-dupes case-insensitively across items and extras, ignoring blanks", () => {
    expect(
      categoryOptions(
        [{ name: "a", category: "Spices" }, { name: "b" }],
        ["spices", "Baking", " "],
      ),
    ).toEqual(["Baking", "Spices"]);
  });
});

describe("groceryAddedMessage", () => {
  it("mentions skipped staples", () => {
    expect(groceryAddedMessage(5, ["salt", "black pepper"])).toBe(
      "Added 5 ingredients to your grocery list. Skipped 2 staples you have in stock: salt, black pepper.",
    );
  });

  it("is plain when nothing was skipped and handles singulars", () => {
    expect(groceryAddedMessage(1)).toBe(
      "Added 1 ingredient to your grocery list.",
    );
    expect(groceryAddedMessage(3, [])).toBe(
      "Added 3 ingredients to your grocery list.",
    );
    expect(groceryAddedMessage(2, ["salt"])).toContain("Skipped 1 staple you");
  });
});

describe("hasStockedName", () => {
  it("matches ignoring case and surrounding whitespace", () => {
    expect(hasStockedName([{ name: "Black Pepper" }], " black pepper ")).toBe(
      true,
    );
    expect(hasStockedName([{ name: "salt" }], "sea salt")).toBe(false);
  });
});
