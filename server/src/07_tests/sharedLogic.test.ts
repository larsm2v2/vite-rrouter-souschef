import fs from "fs";
import path from "path";
import { mergeItems, normalizeName, GroceryItem } from "../utils/groceryMerge";
import { parseIngredientLine } from "../utils/recipeMath/ingredient";

const fixturesDir = path.join(process.cwd(), "..", "shared-fixtures");
const present = fs.existsSync(fixturesDir);
const load = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(fixturesDir, file), "utf8"));
const maybe = present ? describe : describe.skip;

maybe("shared grocery merge fixture (same cases the client runs)", () => {
  const cases: {
    name: string;
    existing: GroceryItem[];
    incoming: unknown[];
    expected: GroceryItem[];
  }[] = present ? load("grocery-merge.json") : [];

  cases.forEach(({ name, existing, incoming, expected }) => {
    it(name, () => {
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
      expect(JSON.stringify(existing)).toBe(before);
    });
  });
});

maybe("shared ingredient parse fixture (same cases the client runs)", () => {
  const cases: {
    input: string;
    quantity: unknown;
    unit: string | null;
    name: string;
    note?: string;
  }[] = present ? load("ingredient-parse.json") : [];
  cases.forEach((c) => {
    it(`parses ${JSON.stringify(c.input)}`, () => {
      const parsed = parseIngredientLine(c.input);
      expect(parsed.quantity).toEqual(c.quantity);
      expect(parsed.unit).toBe(c.unit);
      expect(parsed.name).toBe(c.name);
      expect(parsed.note).toBe(c.note);
    });
  });
});

describe("normalizeName", () => {
  it("folds case, spacing and simple plurals", () => {
    expect(normalizeName("  Red   Onions ")).toBe("red onion");
    expect(normalizeName("hummus")).toBe("hummus");
  });
});
