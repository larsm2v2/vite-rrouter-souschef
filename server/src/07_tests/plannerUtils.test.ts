import {
  addDays,
  groupByWeek,
  parseIsoDate,
  weekStartFor,
} from "../utils/mealPlanWeeks";
import {
  isInStockStaple,
  normalizeStapleName,
  sanitizeStaples,
} from "../utils/staples";

describe("meal plan weeks", () => {
  it("finds the week start for any configured start day", () => {
    // 2026-11-18 is a Wednesday
    expect(weekStartFor("2026-11-18", 1)).toBe("2026-11-16");
    expect(weekStartFor("2026-11-16", 1)).toBe("2026-11-16");
    expect(weekStartFor("2026-11-15", 1)).toBe("2026-11-09"); // Sunday belongs to the previous Mon-Sun week
    expect(weekStartFor("2026-11-18", 0)).toBe("2026-11-15");
    expect(weekStartFor("2026-11-18", 6)).toBe("2026-11-14");
  });

  it("does arithmetic across month and year ends without timezone drift", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("11/16/2026")).toBeNull();
    expect(parseIsoDate(20261116)).toBeNull();
  });

  it("groups entries into weeks, newest first, with counts", () => {
    const weeks = groupByWeek(
      [
        { plannedDate: "2026-11-10", isCooked: true },
        { plannedDate: "2026-11-09", isCooked: false },
        { plannedDate: "2026-11-17" },
      ],
      1,
    );
    expect(weeks.map((w) => [w.weekStart, w.weekEnd])).toEqual([
      ["2026-11-16", "2026-11-22"],
      ["2026-11-09", "2026-11-15"],
    ]);
    expect(weeks[1]).toMatchObject({ plannedCount: 2, cookedCount: 1 });
    expect(weeks[1].entries.map((e) => e.plannedDate)).toEqual([
      "2026-11-09",
      "2026-11-10",
    ]);
  });
});

describe("staples", () => {
  const staples = [
    { name: "Salt" },
    { name: "black pepper" },
    { name: "eggs", runningLow: true },
    { name: "olive oil" },
  ];

  it("matches descriptors and plurals but not different ingredients", () => {
    expect(isInStockStaple("kosher salt", staples)).toBe(true);
    expect(isInStockStaple("freshly ground pepper", staples)).toBe(true);
    expect(isInStockStaple("Extra-virgin olive oil", staples)).toBe(true);
    expect(isInStockStaple("bell pepper", staples)).toBe(false);
    expect(isInStockStaple("salted butter", staples)).toBe(false);
  });

  it("does not skip staples marked as running low", () => {
    expect(isInStockStaple("eggs", staples)).toBe(false);
  });

  it("normalizes plurals consistently on both sides", () => {
    expect(normalizeStapleName("Tomatoes")).toBe(normalizeStapleName("tomato"));
    expect(normalizeStapleName("berries")).toBe(normalizeStapleName("berry"));
  });

  it("sanitizes input: trims, dedupes, drops blanks, rejects malformed", () => {
    expect(
      sanitizeStaples([
        { name: "  Salt ", category: " Spices " },
        { name: "salt" },
        { name: "   " },
        { name: "flour", runningLow: true },
      ]),
    ).toEqual([
      { name: "Salt", category: "Spices" },
      { name: "flour", runningLow: true },
    ]);
    expect(sanitizeStaples([{ nope: 1 }])).toBeNull();
    expect(sanitizeStaples("x")).toBeNull();
  });
});
