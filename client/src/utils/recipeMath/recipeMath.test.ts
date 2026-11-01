import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  canonicalUnit,
  convert,
  findDurations,
  formatCountdown,
  formatIngredient,
  formatNumber,
  formatQuantity,
  normalizeApiIngredient,
  parseIngredientLine,
  parseQuantityPrefix,
  scaleIngredient,
  smoothUnit,
  tokenizeInstruction,
} from "./index";

interface ParseCase {
  input: string;
  quantity: unknown;
  unit: string | null;
  name: string;
  note?: string;
}

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../../shared-fixtures/ingredient-parse.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as ParseCase[];

describe("parseIngredientLine (shared fixture)", () => {
  it.each(fixture)("parses %j", (c) => {
    const parsed = parseIngredientLine(c.input);
    expect(parsed.quantity).toEqual(c.quantity);
    expect(parsed.unit).toBe(c.unit);
    expect(parsed.name).toBe(c.name);
    expect(parsed.note).toBe(c.note);
    expect(parsed.raw).toBe(c.input);
  });

  it("never throws or drops text for odd input", () => {
    for (const input of [
      "???",
      "1/0 cup x",
      "  ",
      "12345678901234567890 g y",
      "½",
      "1 cup",
    ]) {
      const parsed = parseIngredientLine(input);
      expect(parsed.raw).toBe(input);
    }
  });
});

describe("parseQuantityPrefix", () => {
  it.each([
    ["1 1/2 cups", 1.5, " cups"],
    ["½ tsp", 0.5, " tsp"],
    ["1/3 cup", 1 / 3, " cup"],
    ["2.5 kg", 2.5, " kg"],
    ["1½ cups", 1.5, " cups"],
    ["1-1/2 cups", 1.5, " cups"],
  ])("%s", (text, value, rest) => {
    expect(parseQuantityPrefix(text)).toEqual({ quantity: value, rest });
  });

  it("parses ranges and rejects reversed ones", () => {
    expect(parseQuantityPrefix("2-4 tbsp")?.quantity).toEqual({
      min: 2,
      max: 4,
    });
    expect(parseQuantityPrefix("4-2 tbsp")).toBeNull();
    expect(parseQuantityPrefix("salt")).toBeNull();
    expect(parseQuantityPrefix("1/0 cup")).toBeNull();
  });
});

describe("formatting", () => {
  it.each([
    [0.333, "⅓"],
    [0.5, "½"],
    [1.5, "1 ½"],
    [0.667, "⅔"],
    [2.25, "2 ¼"],
    [3, "3"],
    [0.0625, "0.1"],
    [10.4, "10"],
    [4.5, "4 ½"],
    [0.99, "1"],
  ])("formatNumber(%s) = %s", (n, text) => {
    expect(formatNumber(n)).toBe(text);
  });

  it("formats ranges", () => {
    expect(formatQuantity({ min: 2, max: 4 })).toBe("2-4");
  });
});

describe("scaling", () => {
  const scale = (line: string, f: number) =>
    formatIngredient(scaleIngredient(parseIngredientLine(line), f));

  it.each([
    ["1 1/2 cups flour", 2, "3 cups flour"],
    ["½ tsp salt", 2, "1 tsp salt"],
    ["2 eggs", 1.5, "3 eggs"],
    ["1-2 cloves garlic", 2, "2-4 cloves garlic"],
    ["⅓ cup sugar", 2, "⅔ cup sugar"],
    ["1 cup flour", 4 / 6, "⅔ cup flour"],
    ["2 tsp salt", 1.5, "1 tbsp salt"],
    ["4 tbsp butter", 1, "4 tbsp butter"],
    ["500 g potatoes", 2, "1 kg potatoes"],
  ])("%s x%s", (line, factor, expected) => {
    expect(scale(line, factor)).toBe(expected);
  });

  it("leaves unquantified and pinch items alone", () => {
    expect(scale("salt, to taste", 3)).toBe("salt, to taste");
    expect(scale("a pinch of nutmeg", 3)).toBe("a pinch of nutmeg");
  });

  it("ignores invalid factors", () => {
    const ing = parseIngredientLine("1 cup flour");
    for (const f of [0, -1, NaN, Infinity])
      expect(scaleIngredient(ing, f)).toBe(ing);
  });

  it("falls back to the raw text when a line is unstructured", () => {
    expect(scale("Fresh basil leaves", 2)).toBe("Fresh basil leaves");
  });
});

describe("units", () => {
  it("recognizes aliases", () => {
    expect(canonicalUnit("Tablespoons")).toBe("tbsp");
    expect(canonicalUnit("lbs.")).toBe("lb");
    expect(canonicalUnit("eggs")).toBeNull();
  });

  it("converts within a family only", () => {
    expect(convert(1, "cup", "ml")).toBeCloseTo(236.588, 2);
    expect(convert(3, "tsp", "tbsp")).toBeCloseTo(1, 6);
    expect(convert(1, "cup", "g")).toBeNull();
    expect(convert(1, "clove", "can")).toBeNull();
  });

  it("round-trips cup through ml without drift", () => {
    const ml = convert(1, "cup", "ml")!;
    expect(convert(ml, "ml", "cup")).toBeCloseTo(1, 9);
  });

  it("smooths units only when the result is clean", () => {
    expect(smoothUnit(3, "tsp")).toEqual({ value: 1, unit: "tbsp" });
    expect(smoothUnit(3, "tbsp").unit).toBe("tbsp");
    expect(smoothUnit(16, "tbsp")).toEqual({ value: 1, unit: "cup" });
    expect(smoothUnit(0.5, "cup")).toEqual({ value: 0.5, unit: "cup" });
    expect(smoothUnit(2, "clove")).toEqual({ value: 2, unit: "clove" });
  });
});

describe("normalizeApiIngredient", () => {
  it("handles strings and structured items", () => {
    expect(normalizeApiIngredient("2 cups milk").unit).toBe("cup");
    const structured = normalizeApiIngredient({
      name: "flour",
      quantity: 2,
      unit: "cups",
    });
    expect(structured).toMatchObject({
      quantity: 2,
      unit: "cup",
      name: "flour",
    });
    expect(
      normalizeApiIngredient({ name: "salt", quantity: 0 }).quantity,
    ).toBeNull();
  });
});

describe("findDurations", () => {
  const texts = (s: string) => findDurations(s).map((d) => d.text);

  it.each([
    ["simmer 10 minutes", ["10 minutes"], 600],
    ["bake 1 hour 30 minutes", ["1 hour 30 minutes"], 5400],
    ["bake 1 hour and 15 minutes", ["1 hour and 15 minutes"], 4500],
    ["rest 1½ hours", ["1½ hours"], 5400],
    ["whisk 30 seconds", ["30 seconds"], 30],
    ["chill 2 hrs", ["2 hrs"], 7200],
    ["cook for 1.5 hours", ["1.5 hours"], 5400],
    ["wait half an hour", ["half an hour"], 1800],
  ])("matches %s", (text, expected, seconds) => {
    expect(texts(text)).toEqual(expected);
    expect(findDurations(text)[0].seconds).toBe(seconds);
  });

  it("uses the lower bound for ranges and keeps the upper bound", () => {
    const [d] = findDurations("cook 10-12 minutes");
    expect(d.seconds).toBe(600);
    expect(d.maxSeconds).toBe(720);
  });

  it.each([
    "bake at 350°F",
    "use a 9 inch pan",
    "add 2 cups of flour",
    "see step 10",
    "make 10 batches",
    "stir in 5 g salt",
    "cook until golden",
    "0 minutes",
  ])("does not match %s", (text) => {
    expect(findDurations(text)).toEqual([]);
  });

  it("finds several timers in one step", () => {
    expect(texts("Sear 3 minutes per side, then rest 5 minutes")).toEqual([
      "3 minutes",
      "5 minutes",
    ]);
  });
});

describe("tokenizeInstruction", () => {
  it("splits text and timers without losing characters", () => {
    const text = "Simmer for 10 minutes, then serve.";
    const tokens = tokenizeInstruction(text);
    expect(tokens.map((t) => t.text).join("")).toBe(text);
    expect(tokens.filter((t) => t.type === "timer")).toHaveLength(1);
  });

  it("treats markup as plain text", () => {
    const text = "<img src=x onerror=alert(1)> 5 minutes";
    const tokens = tokenizeInstruction(text);
    expect(tokens[0]).toEqual({
      type: "text",
      text: "<img src=x onerror=alert(1)> ",
    });
  });

  it("returns a single text token when there is no duration", () => {
    expect(tokenizeInstruction("Mix well.")).toEqual([
      { type: "text", text: "Mix well." },
    ]);
  });
});

describe("formatCountdown", () => {
  it.each([
    [600, "10:00"],
    [65, "1:05"],
    [3725, "1:02:05"],
    [0, "0:00"],
    [-5, "0:00"],
    [0.2, "0:01"],
  ])("%s -> %s", (s, text) => expect(formatCountdown(s)).toBe(text));
});
