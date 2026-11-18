import type { MealType } from "../../utils/mealPlanWeeks";
import type { RecipeModel } from "../../types";

/** Favorites first, ranked by how often they were cooked, then everything else A-Z. */
export function rankRecipes(recipes: RecipeModel[]): RecipeModel[] {
  return [...recipes].sort((a, b) => {
    const favoriteDiff = Number(!!b.is_favorite) - Number(!!a.is_favorite);
    if (favoriteDiff) return favoriteDiff;
    const cookedDiff = (b.cook_count ?? 0) - (a.cook_count ?? 0);
    if (cookedDiff) return cookedDiff;
    return a.name.localeCompare(b.name);
  });
}

export interface MealPlanEntry {
  id: number;
  recipeId: number | null;
  recipeName: string | null;
  plannedDate: string;
  mealType: MealType | null;
  isCooked: boolean;
  kind: "meal" | "leftover";
  /** The planned meal a leftover card came from. */
  sourceEntryId: number | null;
  /** Recipe scale for a planned meal (1 to 4 in half steps). */
  multiplier: number;
  leftoverCount: number;
  /** Stable React key; keeps a card mounted when its optimistic temp id is replaced by the saved id. */
  clientKey?: number;
}

export interface PlannerSettingsData {
  weekStartDay: number;
  favoriteThreshold: number;
  visibleSlots: MealType[];
  householdSize: number;
}

export const MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 3.5, 4];

export const SLOT_PRESETS: { label: string; slots: MealType[] }[] = [
  { label: "Dinners only", slots: ["dinner"] },
  { label: "Breakfast + Dinner", slots: ["breakfast", "dinner"] },
  { label: "All meals", slots: ["breakfast", "lunch", "dinner", "snack"] },
];

/** Reads a server error message, falling back to a generic one. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { error?: unknown } } })
    ?.response?.data?.error;
  return typeof message === "string" && message ? message : fallback;
}

export interface CompletionResult {
  recorded: boolean;
  cookCount: number;
  isFavorite: boolean;
  autoFavorited: boolean;
}

export interface HistoryWeek {
  weekStart: string;
  weekEnd: string;
  plannedCount: number;
  cookedCount: number;
  entries: MealPlanEntry[];
}

export const SLOT_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Local-time date from a YYYY-MM-DD string (avoids the UTC shift of `new Date(iso)`). */
export function localDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDay(iso: string): string {
  return localDate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const first = localDate(start);
  const last = localDate(end);
  const year = last.getFullYear();
  return `${first.toLocaleDateString(undefined, opts)} – ${last.toLocaleDateString(undefined, opts)}, ${year}`;
}
