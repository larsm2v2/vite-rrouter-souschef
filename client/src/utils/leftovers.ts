import { MEAL_TYPES, addDays, type MealType } from "./mealPlanWeeks";

export interface SlotRef {
  plannedDate: string;
  mealType: MealType;
}

const MAX_SUGGESTED = 6;

/** Servings from the recipe model, which may be a number or text like "4 servings". */
export function servingsOf(value: unknown): number | null {
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value === "string") {
    const match = /\d+(?:\.\d+)?/.exec(value);
    const parsed = match ? Number(match[0]) : 0;
    return parsed > 0 ? parsed : null;
  }
  return null;
}

/**
 * How many extra meals a cooked batch covers: total portions (servings x
 * multiplier) divided by the household, minus the meal that is cooked itself.
 */
export function suggestLeftoverCount(
  servings: number | null,
  multiplier: number,
  householdSize: number,
): number {
  if (!servings || householdSize < 1) return 0;
  const meals = Math.floor((servings * multiplier) / householdSize);
  return Math.min(MAX_SUGGESTED, Math.max(0, meals - 1));
}

/**
 * The next slots after a meal where leftovers could be eaten. Lunch and dinner
 * are preferred (nobody plans leftover breakfasts by default); when neither is
 * visible, whatever slots are visible are used.
 */
export function slotsAfter(
  source: SlotRef,
  visibleSlots: readonly MealType[],
  limit: number,
  horizonDays = 14,
): SlotRef[] {
  const preferred = visibleSlots.filter(
    (slot) => slot === "lunch" || slot === "dinner",
  );
  const eligible = MEAL_TYPES.filter((slot) =>
    (preferred.length > 0 ? preferred : visibleSlots).includes(slot),
  );
  const sourceIndex = MEAL_TYPES.indexOf(source.mealType);
  const out: SlotRef[] = [];
  for (let offset = 0; offset <= horizonDays && out.length < limit; offset++) {
    const plannedDate = addDays(source.plannedDate, offset);
    for (const mealType of eligible) {
      if (offset === 0 && MEAL_TYPES.indexOf(mealType) <= sourceIndex) continue;
      out.push({ plannedDate, mealType });
      if (out.length >= limit) break;
    }
  }
  return out;
}
