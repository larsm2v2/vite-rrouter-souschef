import type { ParsedRecipe } from "../components/common/ParsedRecipeEditor";

export type ImportSection = "details" | "ingredients" | "instructions" | "notes";

/** Sections pre-selected after a fetch. Notes stay off so hand-written notes are not replaced by default. */
export const DEFAULT_SECTIONS: ImportSection[] = [
  "details",
  "ingredients",
  "instructions",
];

const DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i;

/** "PT1H30M" -> "1 hr 30 min". Anything that is not an ISO duration is returned unchanged. */
export function isoDurationToText(value: string): string {
  const match = DURATION.exec(value.trim());
  if (!match) return value;
  const [, days, hours, minutes, seconds] = match.map((part) =>
    part === undefined ? 0 : Number(part),
  );
  const parts = [
    days ? `${days} ${days === 1 ? "day" : "days"}` : "",
    hours ? `${hours} hr` : "",
    minutes ? `${minutes} min` : "",
    !days && !hours && !minutes && seconds ? `${seconds} sec` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : value;
}

const nonEmptyGroups = (ingredients: ParsedRecipe["ingredients"] | undefined) =>
  Object.entries(ingredients ?? {}).filter(([, items]) =>
    items.some((item) => (typeof item === "string" ? item.trim() : item?.name)),
  );

const hasDetails = (recipe: ParsedRecipe) =>
  Boolean(
    recipe.name?.trim() ||
      recipe.cuisine?.trim() ||
      recipe.mealType?.trim() ||
      recipe.servingInfo?.prepTime ||
      recipe.servingInfo?.cookTime ||
      recipe.servingInfo?.totalTime ||
      recipe.servingInfo?.servings,
  );

/** Which sections the fetched page actually provided. */
export function availableSections(fetched: ParsedRecipe): ImportSection[] {
  const sections: ImportSection[] = [];
  if (hasDetails(fetched)) sections.push("details");
  if (nonEmptyGroups(fetched.ingredients).length > 0)
    sections.push("ingredients");
  if (fetched.instructions?.some((step) => step.text?.trim()))
    sections.push("instructions");
  if (fetched.notes?.some((note) => note.trim())) sections.push("notes");
  return sections;
}

/**
 * Copy the chosen sections of a fetched page into an editing draft. Details are
 * merged field by field so a page that lacks, say, a cook time never wipes the
 * one already saved; the other sections replace what was there.
 */
export function applySections(
  draft: ParsedRecipe,
  fetched: ParsedRecipe,
  sections: ImportSection[],
): ParsedRecipe {
  const next: ParsedRecipe = { ...draft };

  if (sections.includes("details")) {
    if (fetched.name?.trim()) next.name = fetched.name.trim();
    if (fetched.cuisine?.trim()) next.cuisine = fetched.cuisine.trim();
    if (fetched.mealType?.trim()) next.mealType = fetched.mealType.trim();
    const info = { ...(draft.servingInfo ?? {}) };
    for (const key of ["prepTime", "cookTime", "totalTime"] as const) {
      const value = fetched.servingInfo?.[key];
      if (value?.trim()) info[key] = isoDurationToText(value);
    }
    if (fetched.servingInfo?.servings && fetched.servingInfo.servings > 0)
      info.servings = fetched.servingInfo.servings;
    next.servingInfo = info;
  }

  if (sections.includes("ingredients")) {
    const groups = nonEmptyGroups(fetched.ingredients);
    if (groups.length > 0) next.ingredients = Object.fromEntries(groups);
  }

  if (sections.includes("instructions")) {
    const steps = (fetched.instructions ?? []).filter((s) => s.text?.trim());
    if (steps.length > 0)
      next.instructions = steps.map((step, index) => ({
        number: index + 1,
        text: step.text.trim(),
      }));
  }

  if (sections.includes("notes")) {
    const notes = (fetched.notes ?? []).filter((n) => n.trim());
    if (notes.length > 0) next.notes = notes;
  }

  return next;
}
