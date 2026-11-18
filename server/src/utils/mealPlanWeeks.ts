export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Parse a strict YYYY-MM-DD string to a UTC date, or null when invalid. */
export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return toIso(date) === value ? date : null;
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  if (!date) throw new Error(`Invalid date: ${iso}`);
  return toIso(new Date(date.getTime() + days * DAY_MS));
}

export function daysBetween(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) throw new Error("Invalid date range");
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

/** First day of the week containing `iso`; weekStartDay is 0 (Sun) - 6 (Sat). */
export function weekStartFor(iso: string, weekStartDay = 1): string {
  const date = parseIsoDate(iso);
  if (!date) throw new Error(`Invalid date: ${iso}`);
  const offset = (date.getUTCDay() - weekStartDay + 7) % 7;
  return addDays(iso, -offset);
}

export interface DatedEntry {
  plannedDate: string;
  isCooked?: boolean;
}

export interface WeekGroup<T extends DatedEntry> {
  weekStart: string;
  weekEnd: string;
  plannedCount: number;
  cookedCount: number;
  entries: T[];
}

/** Group entries into weeks, newest week first, entries ordered by date within a week. */
export function groupByWeek<T extends DatedEntry>(
  entries: T[],
  weekStartDay = 1,
): WeekGroup<T>[] {
  const weeks = new Map<string, WeekGroup<T>>();
  for (const entry of entries) {
    const weekStart = weekStartFor(entry.plannedDate, weekStartDay);
    let week = weeks.get(weekStart);
    if (!week) {
      week = {
        weekStart,
        weekEnd: addDays(weekStart, 6),
        plannedCount: 0,
        cookedCount: 0,
        entries: [],
      };
      weeks.set(weekStart, week);
    }
    week.entries.push(entry);
    week.plannedCount += 1;
    if (entry.isCooked) week.cookedCount += 1;
  }
  const groups = [...weeks.values()];
  groups.forEach((week) =>
    week.entries.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)),
  );
  return groups.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

/** Today's date in the user's local timezone as YYYY-MM-DD. */
export function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
