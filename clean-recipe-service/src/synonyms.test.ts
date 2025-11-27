import {
  canonicalizeIngredient,
  getVariants,
  hasSynonyms,
  getSynonymStats,
} from "./synonyms";

describe("Ingredient Synonyms", () => {
  describe("canonicalizeIngredient", () => {
    it("should return canonical form for known synonyms", () => {
      expect(canonicalizeIngredient("black pepper")).toBe("pepper");
      expect(canonicalizeIngredient("evoo")).toBe("olive oil");
      expect(canonicalizeIngredient("sea salt")).toBe("salt");
      expect(canonicalizeIngredient("minced beef")).toBe("ground beef");
    });

    it("should be case-insensitive", () => {
      expect(canonicalizeIngredient("BLACK PEPPER")).toBe("pepper");
      expect(canonicalizeIngredient("Black Pepper")).toBe("pepper");
      expect(canonicalizeIngredient("bLaCk PePpEr")).toBe("pepper");
    });

    it("should handle whitespace", () => {
      expect(canonicalizeIngredient("  black pepper  ")).toBe("pepper");
      expect(canonicalizeIngredient("\tblack pepper\n")).toBe("pepper");
    });

    it("should return canonical form unchanged if already canonical", () => {
      expect(canonicalizeIngredient("pepper")).toBe("pepper");
      expect(canonicalizeIngredient("salt")).toBe("salt");
      expect(canonicalizeIngredient("olive oil")).toBe("olive oil");
    });

    it("should return original ingredient if unknown", () => {
      expect(canonicalizeIngredient("dragon fruit")).toBe("dragon fruit");
      expect(canonicalizeIngredient("unicorn tears")).toBe("unicorn tears");
    });

    it("should handle edge cases", () => {
      expect(canonicalizeIngredient("")).toBe("");
      expect(canonicalizeIngredient(null as any)).toBe(null);
      expect(canonicalizeIngredient(undefined as any)).toBe(undefined);
    });
  });

  describe("getVariants", () => {
    it("should return all variants for a canonical ingredient", () => {
      const pepperVariants = getVariants("pepper");
      expect(pepperVariants).toContain("black pepper");
      expect(pepperVariants).toContain("ground pepper");
      expect(pepperVariants.length).toBeGreaterThan(0);
    });

    it("should return empty array for unknown ingredient", () => {
      expect(getVariants("dragon fruit")).toEqual([]);
    });
  });

  describe("hasSynonyms", () => {
    it("should return true for ingredients with synonyms", () => {
      expect(hasSynonyms("pepper")).toBe(true);
      expect(hasSynonyms("black pepper")).toBe(true);
      expect(hasSynonyms("salt")).toBe(true);
    });

    it("should return false for unknown ingredients", () => {
      expect(hasSynonyms("dragon fruit")).toBe(false);
    });
  });

  describe("getSynonymStats", () => {
    it("should return valid statistics", () => {
      const stats = getSynonymStats();

      expect(stats.canonicalCount).toBeGreaterThan(0);
      expect(stats.totalVariants).toBeGreaterThan(0);
      expect(stats.averageVariantsPerCanonical).toBeGreaterThan(0);
      expect(stats.totalVariants).toBeGreaterThanOrEqual(stats.canonicalCount);
    });
  });

  describe("Real-world usage scenarios", () => {
    it("should handle common recipe ingredient variations", () => {
      const testCases = [
        { input: "extra virgin olive oil", expected: "olive oil" },
        { input: "kosher salt", expected: "salt" },
        { input: "boneless chicken breast", expected: "chicken breast" },
        { input: "all-purpose flour", expected: "flour" },
        { input: "granulated sugar", expected: "sugar" },
        { input: "fresh basil", expected: "basil" },
        { input: "yellow onion", expected: "onion" },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(canonicalizeIngredient(input)).toBe(expected);
      });
    });
  });
});
