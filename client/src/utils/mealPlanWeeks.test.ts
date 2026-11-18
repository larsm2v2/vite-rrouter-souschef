import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { addDays, groupByWeek, localToday, weekStartFor } from "./mealPlanWeeks";

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../../shared-fixtures/week-start.json", import.meta.url),
    ),
    "utf8",
  ),
) as { date: string; weekStartDay: number; weekStart: string }[];

describe("weekStartFor (shared fixture)", () => {
  fixture.forEach((c) => {
    it(`${c.date} with week starting on day ${c.weekStartDay}`, () => {
      expect(weekStartFor(c.date, c.weekStartDay)).toBe(c.weekStart);
    });
  });
});

describe("week helpers", () => {
  it("formats local dates without UTC shifting", () => {
    expect(localToday(new Date(2026, 10, 3, 23, 30))).toBe("2026-11-03");
  });

  it("groups into weeks newest first", () => {
    const weeks = groupByWeek(
      [{ plannedDate: "2026-11-02" }, { plannedDate: "2026-11-10" }],
      1,
    );
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-11-09", "2026-11-02"]);
    expect(addDays("2026-11-02", 6)).toBe("2026-11-08");
  });
});
