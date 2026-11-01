import {
  formatNumber,
  formatQuantity,
  parseQuantityPrefix,
  quantityValue,
  scaleQuantity,
  type Quantity,
} from "./quantity";
import { canonicalUnit, convert, unitLabel } from "./units";

export interface NormalizedIngredient {
  /** Original text; always kept so nothing is ever lost or mis-rendered. */
  raw: string;
  quantity: Quantity | null;
  unit: string | null;
  name: string;
  note?: string;
}

const UNSCALED_UNITS = new Set(["pinch", "dash"]);

/** Parse one ingredient line. Never throws and never drops text. */
export function parseIngredientLine(input: string): NormalizedIngredient {
  const raw = String(input ?? "");
  let text = raw.trim().replace(/^[-•*·]\s*/, "");
  if (!text) return { raw, quantity: null, unit: null, name: "" };

  let quantity: Quantity | null = null;
  let unit: string | null = null;
  const notes: string[] = [];

  const article = /^(?:an?)\s+(?=\w)/i.exec(text);
  const parsed = parseQuantityPrefix(text);
  if (parsed) {
    quantity = parsed.quantity;
    text = parsed.rest.trim();
  } else if (article) {
    const after = text.slice(article[0].length);
    const first = /^([A-Za-z]+)/.exec(after);
    const articleUnit = first ? canonicalUnit(first[1]) : null;
    if (articleUnit && (articleUnit === "pinch" || articleUnit === "dash")) {
      text = after;
    }
  }

  const leadingParen = /^\(([^)]*)\)\s*/.exec(text);
  if (leadingParen && quantity !== null) {
    notes.push(leadingParen[1].trim());
    text = text.slice(leadingParen[0].length);
  }

  const twoWord = /^(fl\.?\s*oz\.?|fluid\s+ounces?)(?=\s|$)/i.exec(text);
  const oneWord = /^([A-Za-z]+)\.?(?=[\s,(]|$)/.exec(text);
  const unitMatch = twoWord ?? oneWord;
  if (unitMatch) {
    const key = canonicalUnit(unitMatch[1].replace(/\s+/g, " "));
    if (key && (quantity !== null || key === "pinch" || key === "dash")) {
      unit = key;
      text = text.slice(unitMatch[0].length).trim();
    }
  }

  text = text.replace(/^of\s+/i, "");

  const afterUnitParen = /^\(([^)]*)\)\s*/.exec(text);
  if (afterUnitParen && quantity !== null) {
    notes.push(afterUnitParen[1].trim());
    text = text.slice(afterUnitParen[0].length);
  }

  const trailingParen = /\s*\(([^)]*)\)\s*$/.exec(text);
  if (trailingParen) {
    notes.push(trailingParen[1].trim());
    text = text.slice(0, trailingParen.index);
  }
  const comma = text.indexOf(",");
  if (comma > 0) {
    notes.push(text.slice(comma + 1).trim());
    text = text.slice(0, comma);
  }

  const name = text.trim();
  const note = notes.filter(Boolean).join("; ");
  return { raw, quantity, unit, name, ...(note ? { note } : {}) };
}

/** True when the line was understood well enough to scale or merge. */
export function isStructured(ing: NormalizedIngredient): boolean {
  return ing.quantity !== null && ing.name.length > 0;
}

const SMOOTH_STEPS: Record<string, string[]> = {
  tsp: ["tsp", "tbsp", "cup"],
  tbsp: ["tsp", "tbsp", "cup"],
  cup: ["tsp", "tbsp", "cup"],
  ml: ["ml", "l"],
  l: ["ml", "l"],
  g: ["g", "kg"],
  kg: ["g", "kg"],
};

function isCleanFraction(value: number): boolean {
  const eighths = value * 8;
  return (
    Math.abs(eighths - Math.round(eighths)) < 0.05 ||
    Math.abs(value * 3 - Math.round(value * 3)) < 0.03
  );
}

/** Move to a larger unit in the same ladder when the result still reads as a clean amount. */
export function smoothUnit(
  value: number,
  unit: string,
): { value: number; unit: string } {
  const ladder = SMOOTH_STEPS[unit];
  if (!ladder) return { value, unit };
  const startIndex = ladder.indexOf(unit);
  let best = { value, unit };
  for (const candidate of ladder.slice(startIndex + 1)) {
    const converted = convert(value, unit, candidate);
    if (converted === null || converted < 1) continue;
    if (isCleanFraction(converted))
      best = { value: converted, unit: candidate };
  }
  return best;
}

export function scaleIngredient(
  ing: NormalizedIngredient,
  factor: number,
): NormalizedIngredient {
  if (!isStructured(ing) || ing.quantity === null) return ing;
  if (ing.unit && UNSCALED_UNITS.has(ing.unit)) return ing;
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return ing;
  const scaled = scaleQuantity(ing.quantity, factor);
  if (ing.unit && typeof scaled === "number") {
    const smooth = smoothUnit(scaled, ing.unit);
    return { ...ing, quantity: smooth.value, unit: smooth.unit };
  }
  return { ...ing, quantity: scaled };
}

/** Human text for an ingredient. Falls back to the raw line when it could not be parsed. */
export function formatIngredient(ing: NormalizedIngredient): string {
  if (!isStructured(ing) || ing.quantity === null) return ing.raw.trim();
  const amount = formatQuantity(ing.quantity);
  const unit = ing.unit ? unitLabel(ing.unit, quantityValue(ing.quantity)) : "";
  const head = [amount, unit, ing.name].filter(Boolean).join(" ");
  return ing.note ? `${head}, ${ing.note}` : head;
}

/** Build a NormalizedIngredient from the API shapes (string or {name, quantity, unit}). */
export function normalizeApiIngredient(
  item: string | { name?: string; quantity?: number | string; unit?: string },
): NormalizedIngredient {
  if (typeof item === "string") return parseIngredientLine(item);
  const name = String(item?.name ?? "").trim();
  const q =
    typeof item?.quantity === "string" ? Number(item.quantity) : item?.quantity;
  const quantity =
    typeof q === "number" && Number.isFinite(q) && q > 0 ? q : null;
  const unitRaw = String(item?.unit ?? "").trim();
  const unit = unitRaw
    ? (canonicalUnit(unitRaw) ?? unitRaw.toLowerCase())
    : null;
  const raw = [quantity !== null ? formatNumber(quantity) : "", unitRaw, name]
    .filter(Boolean)
    .join(" ");
  return { raw, quantity, unit, name };
}
