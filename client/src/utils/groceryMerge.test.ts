import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  mergeItems,
  normalizeName,
  removeRecipeSource,
  type GroceryItem,
} from "./groceryMerge";

interface MergeCase {
  name: string;
  existing: GroceryItem[];
  incoming: unknown[];
  expected: GroceryItem[];
}

const cases = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../../shared-fixtures/grocery-merge.json", import.meta.url),
    ),
    "utf8",
  ),
) as MergeCase[];

describe("mergeItems (shared fixture, also run by the server)", () => {
  it.each(cases)("$name", ({ existing, incoming, expected }) => {
    const before = JSON.stringify(existing);
    const merged = mergeItems(existing, incoming as GroceryItem[]);
    expect(merged).toHaveLength(expected.length);
    merged.forEach((item, i) => {
      expect(item.name).toBe(expected[i].name);
      expect(item.unit).toBe(expected[i].unit);
      expect(item.checked).toBe(expected[i].checked);
      expect(item.quantity).toBeCloseTo(expected[i].quantity, 3);
      expect(item.sources).toEqual(expected[i].sources);
    });
    expect(JSON.stringify(existing)).toBe(before); // never mutates its input
  });
});

describe("normalizeName", () => {
  it.each([
    ["Eggs", "egg"],
    ["  Red   Onions ", "red onion"],
    ["tomatoes", "tomato"],
    ["cheeses", "cheese"],
    ["peaches", "peach"],
    ["hummus", "hummus"],
    ["", ""],
  ])("%j -> %j", (input, expected) =>
    expect(normalizeName(input)).toBe(expected),
  );
});

describe("removeRecipeSource", () => {
  it("subtracts one recipe's contribution and drops lines it alone created", () => {
    const list: GroceryItem[] = [
      {
        name: "flour",
        quantity: 3,
        unit: "cups",
        checked: false,
        sources: ["a", "b"],
      },
      { name: "leek", quantity: 2, unit: "", checked: false, sources: ["a"] },
      { name: "milk", quantity: 1, unit: "cup", checked: false },
    ];
    const contributions: GroceryItem[] = [
      { name: "flour", quantity: 1, unit: "cup", checked: false },
      { name: "leek", quantity: 2, unit: "", checked: false },
    ];
    const out = removeRecipeSource(list, "a", contributions);
    expect(out.map((i) => i.name)).toEqual(["flour", "milk"]);
    expect(out[0]).toMatchObject({ quantity: 2, unit: "cups", sources: ["b"] });
  });
});
