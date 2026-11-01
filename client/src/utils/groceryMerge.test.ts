import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  mergeConflict,
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

describe("removeRecipeSource on lists saved before sources existed", () => {
  const contributions: GroceryItem[] = [
    { name: "leek", quantity: 2, unit: "", checked: false },
    { name: "flour", quantity: 1, unit: "cup", checked: false },
  ];

  it("subtracts from untagged lines when no line references the recipe", () => {
    const list: GroceryItem[] = [
      { name: "leek", quantity: 2, unit: "", checked: false },
      { name: "flour", quantity: 3, unit: "cups", checked: false },
      { name: "milk", quantity: 1, unit: "cup", checked: false },
    ];
    const out = removeRecipeSource(list, "old", contributions);
    expect(out.map((i) => i.name)).toEqual(["flour", "milk"]);
    expect(out[0].quantity).toBe(2);
  });

  it("leaves untagged lines alone once the recipe is tracked", () => {
    const list: GroceryItem[] = [
      { name: "leek", quantity: 2, unit: "", checked: false, sources: ["a"] },
      { name: "flour", quantity: 3, unit: "cups", checked: false },
    ];
    const out = removeRecipeSource(list, "a", contributions);
    expect(out).toEqual([
      { name: "flour", quantity: 3, unit: "cups", checked: false },
    ]);
  });

  it("does not touch lines the recipe never contributed to", () => {
    const list: GroceryItem[] = [
      { name: "milk", quantity: 1, unit: "cup", checked: false },
    ];
    expect(removeRecipeSource(list, "old", contributions)).toEqual(list);
  });
});

describe("mergeConflict", () => {
  const item = (
    name: string,
    quantity: number,
    extra: Partial<GroceryItem> = {},
  ): GroceryItem => ({ name, quantity, unit: "", checked: false, ...extra });

  it("keeps what each side added", () => {
    const base = [item("apple", 3)];
    const local = [item("apple", 3), item("pear", 1)];
    const server = [item("apple", 3), item("leek", 2)];
    const out = mergeConflict(base, local, server);
    expect(out.map((i) => i.name)).toEqual(["apple", "leek", "pear"]);
  });

  it("applies both sides' quantity changes to the same line", () => {
    const base = [item("flour", 2)];
    const local = [item("flour", 3)]; // user added 1
    const server = [item("flour", 5)]; // a recipe added 3
    expect(mergeConflict(base, local, server)[0].quantity).toBe(6);
  });

  it("takes each side's changes to different fields", () => {
    const base = [item("milk", 1)];
    const local = [item("milk", 1, { checked: true })];
    const server = [item("milk", 1, { aisle: "Dairy" })];
    const [merged] = mergeConflict(base, local, server);
    expect(merged.checked).toBe(true);
    expect(merged.aisle).toBe("Dairy");
  });

  it("a local delete holds unless the server changed that line", () => {
    const base = [item("a", 1), item("b", 1)];
    const local = [item("b", 1)]; // deleted a
    const server = [item("a", 4), item("b", 1)]; // changed a
    expect(mergeConflict(base, local, server).map((i) => i.name)).toEqual([
      "a",
      "b",
    ]);
    const quiet = [item("a", 1), item("b", 1)];
    expect(mergeConflict(base, local, quiet).map((i) => i.name)).toEqual(["b"]);
  });

  it("a server delete holds unless this client changed that line", () => {
    const base = [item("a", 1), item("b", 1)];
    const server = [item("b", 1)];
    expect(
      mergeConflict(base, [item("a", 1), item("b", 1)], server).map(
        (i) => i.name,
      ),
    ).toEqual(["b"]);
    expect(
      mergeConflict(base, [item("a", 2), item("b", 1)], server).map(
        (i) => i.name,
      ),
    ).toEqual(["b", "a"]);
  });

  it("an item added on both sides is summed, not duplicated", () => {
    const out = mergeConflict([], [item("rice", 1)], [item("rice", 2)]);
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBe(3);
  });

  it("unions recipe sources and honours a local removal", () => {
    const base = [item("leek", 2, { sources: ["a"] })];
    const local = [item("leek", 2, { sources: ["a", "b"] })];
    const server = [item("leek", 4, { sources: ["a", "c"] })];
    const [merged] = mergeConflict(base, local, server);
    expect((merged.sources ?? []).slice().sort()).toEqual(["a", "b", "c"]);
    const removed = mergeConflict(base, [item("leek", 2)], server)[0];
    expect(removed.sources).toEqual(["c"]);
  });

  it("with no local changes the server list is returned unchanged", () => {
    const base = [item("a", 1)];
    const server = [item("a", 1), item("b", 2)];
    expect(mergeConflict(base, base, server)).toEqual(server);
  });

  it("does not mutate its inputs", () => {
    const base = [item("a", 1)];
    const local = [item("a", 2)];
    const server = [item("a", 3)];
    const before = JSON.stringify([base, local, server]);
    mergeConflict(base, local, server);
    expect(JSON.stringify([base, local, server])).toBe(before);
  });
});
