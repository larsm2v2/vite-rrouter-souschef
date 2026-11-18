import { describe, expect, it } from "vitest";
import { servingsOf, slotsAfter, suggestLeftoverCount } from "./leftovers";

describe("suggestLeftoverCount", () => {
  it("covers extra meals from servings x multiplier over household size", () => {
    expect(suggestLeftoverCount(4, 1, 2)).toBe(1); // 2 meals, one is cooked now
    expect(suggestLeftoverCount(4, 2, 2)).toBe(3);
    expect(suggestLeftoverCount(6, 1.5, 3)).toBe(2);
  });

  it("suggests none when the batch only feeds the household once, or data is missing", () => {
    expect(suggestLeftoverCount(2, 1, 2)).toBe(0);
    expect(suggestLeftoverCount(1, 1, 4)).toBe(0);
    expect(suggestLeftoverCount(null, 2, 2)).toBe(0);
  });

  it("caps the suggestion", () => {
    expect(suggestLeftoverCount(40, 4, 1)).toBe(6);
  });
});

describe("servingsOf", () => {
  it("reads numbers and servings text", () => {
    expect(servingsOf(4)).toBe(4);
    expect(servingsOf("6 servings")).toBe(6);
    expect(servingsOf("a few")).toBeNull();
    expect(servingsOf(0)).toBeNull();
    expect(servingsOf(undefined)).toBeNull();
  });
});

describe("slotsAfter", () => {
  it("uses the next days' dinners when dinners are the only visible slot", () => {
    expect(
      slotsAfter({ plannedDate: "2026-11-17", mealType: "dinner" }, ["dinner"], 2),
    ).toEqual([
      { plannedDate: "2026-11-18", mealType: "dinner" },
      { plannedDate: "2026-11-19", mealType: "dinner" },
    ]);
  });

  it("prefers lunch and dinner and skips breakfast and snack", () => {
    expect(
      slotsAfter(
        { plannedDate: "2026-11-17", mealType: "dinner" },
        ["breakfast", "lunch", "dinner", "snack"],
        3,
      ),
    ).toEqual([
      { plannedDate: "2026-11-18", mealType: "lunch" },
      { plannedDate: "2026-11-18", mealType: "dinner" },
      { plannedDate: "2026-11-19", mealType: "lunch" },
    ]);
  });

  it("allows a later slot on the same day and never an earlier or equal one", () => {
    expect(
      slotsAfter(
        { plannedDate: "2026-11-17", mealType: "lunch" },
        ["lunch", "dinner"],
        2,
      ),
    ).toEqual([
      { plannedDate: "2026-11-17", mealType: "dinner" },
      { plannedDate: "2026-11-18", mealType: "lunch" },
    ]);
    expect(
      slotsAfter({ plannedDate: "2026-11-17", mealType: "dinner" }, ["lunch"], 1),
    ).toEqual([{ plannedDate: "2026-11-18", mealType: "lunch" }]);
  });

  it("falls back to visible breakfast/snack slots when no lunch or dinner is shown", () => {
    expect(
      slotsAfter({ plannedDate: "2026-11-17", mealType: "dinner" }, ["breakfast"], 1),
    ).toEqual([{ plannedDate: "2026-11-18", mealType: "breakfast" }]);
  });

  it("works across month ends", () => {
    expect(
      slotsAfter({ plannedDate: "2026-12-31", mealType: "dinner" }, ["dinner"], 1),
    ).toEqual([{ plannedDate: "2027-01-01", mealType: "dinner" }]);
  });
});
