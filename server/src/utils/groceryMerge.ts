import {
  canonicalUnit,
  convert,
  isConvertible,
  unitLabel,
} from "./recipeMath/units";

export interface GroceryItem {
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  aisle?: string;
  /** Recipe ids that contributed to this line. */
  sources?: string[];
}

const IRREGULAR: Record<string, string> = {
  leaves: "leaf",
  halves: "half",
  loaves: "loaf",
  knives: "knife",
  cookies: "cookie",
  brownies: "brownie",
  smoothies: "smoothie",
  veggies: "veggie",
  pies: "pie",
  movies: "movie",
};
const NEVER_STRIP = new Set([
  "molasses",
  "couscous",
  "hummus",
  "asparagus",
  "swiss",
  "citrus",
  "lemongrass",
  "bass",
  "grits",
  "oats",
  "greens",
  "chips",
]);

function singular(word: string): string {
  if (NEVER_STRIP.has(word) || word.length < 4) return word;
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (/ies$/.test(word) && word.length > 4) return word.slice(0, -3) + "y";
  if (/(ch|sh|x|z|o)es$/.test(word)) return word.slice(0, -2);
  if (/(ss|us|is)$/.test(word)) return word;
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Lowercase, collapse whitespace, and fold a plural final word. Exact matches only: no fuzzy matching. */
export function normalizeName(name: string): string {
  const words = String(name ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .split(" ");
  if (words.length === 0 || words[0] === "") return "";
  words[words.length - 1] = singular(words[words.length - 1]);
  return words.join(" ");
}

function unitKey(unit: string): string {
  const trimmed = String(unit ?? "")
    .trim()
    .toLowerCase();
  return canonicalUnit(trimmed) ?? trimmed;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function toQuantity(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0;
}

function sameLine(a: GroceryItem, b: GroceryItem): boolean {
  if (normalizeName(a.name) !== normalizeName(b.name)) return false;
  const ua = unitKey(a.unit);
  const ub = unitKey(b.unit);
  return ua === ub || isConvertible(ua, ub);
}

function withUnitLabel(unit: string, quantity: number): string {
  const key = canonicalUnit(unit.trim());
  return key ? unitLabel(key, quantity) : unit;
}

/**
 * Merge incoming items into an existing list without mutating either.
 * Same normalized name and a compatible unit family are summed; everything else stays separate.
 */
export function mergeItems(
  existing: GroceryItem[],
  incoming: GroceryItem[],
): GroceryItem[] {
  const result: GroceryItem[] = existing.map((item) => ({ ...item }));
  for (const raw of incoming) {
    if (!raw || typeof raw.name !== "string" || !raw.name.trim()) continue;
    const item: GroceryItem = {
      ...raw,
      name: raw.name.trim(),
      quantity: toQuantity(raw.quantity),
      unit: String(raw.unit ?? "").trim(),
      checked: false,
    };
    const index = result.findIndex((line) => sameLine(line, item));
    if (index === -1) {
      result.push(item);
      continue;
    }
    const line = result[index];
    const from = unitKey(item.unit);
    const to = unitKey(line.unit);
    const converted =
      from === to
        ? item.quantity
        : (convert(item.quantity, from, to) ?? item.quantity);
    const quantity = round4(line.quantity + converted);
    const sources = Array.from(
      new Set([...(line.sources ?? []), ...(item.sources ?? [])]),
    );
    result[index] = {
      ...line,
      quantity,
      unit: withUnitLabel(line.unit, quantity),
      checked: false,
      ...(sources.length > 0 ? { sources } : {}),
    };
  }
  return result;
}

/** Remove one recipe's contribution; lines with no remaining sources and no quantity are dropped. */
export function removeRecipeSource(
  list: GroceryItem[],
  recipeId: string,
  contributions: GroceryItem[],
): GroceryItem[] {
  const out: GroceryItem[] = [];
  for (const line of list) {
    if (!line.sources || line.sources.indexOf(recipeId) === -1) {
      out.push(line);
      continue;
    }
    const part = contributions.find((c) => sameLine(c, line));
    const sources = line.sources.filter((s) => s !== recipeId);
    const lineUnit = unitKey(line.unit);
    const partQty = part
      ? (convert(part.quantity, unitKey(part.unit), lineUnit) ?? part.quantity)
      : 0;
    const quantity = round4(Math.max(0, line.quantity - partQty));
    if (sources.length === 0 && quantity === 0) continue;
    out.push({
      ...line,
      quantity,
      unit: withUnitLabel(line.unit, quantity),
      ...(sources.length ? { sources } : { sources: undefined }),
    });
  }
  return out;
}
