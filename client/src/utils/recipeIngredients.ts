import {
  formatIngredient,
  normalizeApiIngredient,
  scaleIngredient,
  type NormalizedIngredient,
} from "./recipeMath";

export interface IngredientEntry {
  key: string;
  ingredient: NormalizedIngredient;
}

export interface IngredientGroupView {
  name: string;
  items: IngredientEntry[];
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 20;

/** Accepts the API shape ({ group: (string | {name, quantity, unit})[] }) and never drops a line. */
export function toIngredientGroups(
  ingredients: unknown,
): IngredientGroupView[] {
  if (!ingredients || typeof ingredients !== "object") return [];
  const groups: IngredientGroupView[] = [];
  for (const [name, list] of Object.entries(
    ingredients as Record<string, unknown>,
  )) {
    if (!Array.isArray(list)) continue;
    const items: IngredientEntry[] = [];
    list.forEach((item, index) => {
      if (item === null || item === undefined) return;
      const ingredient = normalizeApiIngredient(
        item as string | { name?: string },
      );
      if (!ingredient.raw.trim() && !ingredient.name) return;
      items.push({ key: `${name}:${index}`, ingredient });
    });
    if (items.length > 0) groups.push({ name, items });
  }
  return groups;
}

export function displayIngredient(
  entry: IngredientEntry,
  scale: number,
): string {
  return formatIngredient(scaleIngredient(entry.ingredient, scale));
}

/** Servings can arrive as a number, "4", "4-6 servings", or nothing. */
export function parseServings(value: unknown): number | null {
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 1
      ? Math.min(99, Math.round(value))
      : null;
  if (typeof value === "string") {
    const m = /\d+/.exec(value);
    if (!m) return null;
    const n = Number(m[0]);
    return n >= 1 ? Math.min(99, n) : null;
  }
  return null;
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}
