import { parseIngredientLine, formatIngredient } from "./recipeMath/ingredient";
import { quantityValue } from "./recipeMath/quantity";

type IngredientObject = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  [key: string]: unknown;
};

/**
 * Recipes arrive from the client with ingredients as plain text lines
 * (URL import, edited previews) or as {name, quantity, unit} objects (AI
 * parsing). Downstream cleaners and the DB expect objects, so convert text
 * lines and drop blanks.
 */
export function normalizeIngredients(ingredients: unknown): unknown {
  if (!ingredients || typeof ingredients !== "object") return ingredients;

  const out: Record<string, IngredientObject[]> = {};
  for (const [category, items] of Object.entries(ingredients)) {
    if (!Array.isArray(items)) continue;

    const normalized: IngredientObject[] = [];
    for (const item of items) {
      if (typeof item === "string") {
        const line = item.trim();
        if (!line) continue;
        const parsed = parseIngredientLine(line);
        const structured = parsed.quantity !== null && parsed.name.length > 0;
        normalized.push({
          id: normalized.length + 1,
          // Unstructured lines keep their full text so nothing is lost.
          name: structured
            ? [parsed.name, parsed.note].filter(Boolean).join(", ")
            : formatIngredient(parsed),
          quantity: structured ? quantityValue(parsed.quantity!) : 0,
          unit: structured ? (parsed.unit ?? "") : "",
        });
      } else if (item && typeof item === "object") {
        normalized.push({
          ...(item as IngredientObject),
          id: (item as IngredientObject).id ?? normalized.length + 1,
        });
      }
    }
    out[category] = normalized;
  }
  return out;
}
