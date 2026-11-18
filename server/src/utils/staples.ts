export interface StapleItem {
  name: string;
  category?: string;
  runningLow?: boolean;
}

const MAX_ITEMS = 500;
const MAX_NAME = 100;
const MAX_CATEGORY = 40;

// Descriptors that do not change which pantry item something is, so
// "black pepper", "ground pepper" and "pepper" all match one staple.
const DESCRIPTORS =
  /^(?:(?:fresh|freshly|ground|cracked|kosher|sea|table|fine|coarse|extra[- ]virgin|dried|black|white|iodized|granulated)\s+)+/;

export function normalizeStapleName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(DESCRIPTORS, "")
    .trim();
  if (base.length > 3 && base.endsWith("ies")) return `${base.slice(0, -3)}y`;
  if (base.length > 3 && base.endsWith("es") && /(?:ch|sh|x|s|o)es$/.test(base))
    return base.slice(0, -2);
  if (base.length > 3 && base.endsWith("s") && !base.endsWith("ss"))
    return base.slice(0, -1);
  return base;
}

/** Validate and clean client-supplied staples: trims, drops blanks, de-duplicates, caps size. */
export function sanitizeStaples(input: unknown): StapleItem[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const out: StapleItem[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    if (typeof item.name !== "string") return null;
    const name = item.name.trim().slice(0, MAX_NAME);
    if (!name) continue;
    const key = normalizeStapleName(name) || name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const category =
      typeof item.category === "string" && item.category.trim()
        ? item.category.trim().slice(0, MAX_CATEGORY)
        : undefined;
    out.push({
      name,
      ...(category ? { category } : {}),
      ...(item.runningLow === true ? { runningLow: true } : {}),
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** True when the ingredient is a staple the user has in stock (not running low). */
export function isInStockStaple(
  ingredientName: string,
  staples: StapleItem[],
): boolean {
  const key = normalizeStapleName(ingredientName);
  if (!key) return false;
  return staples.some(
    (staple) =>
      !staple.runningLow && normalizeStapleName(staple.name) === key,
  );
}

export const STARTER_STAPLES: Record<string, string[]> = {
  Spices: [
    "salt",
    "black pepper",
    "garlic powder",
    "onion powder",
    "paprika",
    "cumin",
    "chili powder",
    "oregano",
    "cinnamon",
  ],
  "Oils & vinegars": [
    "olive oil",
    "vegetable oil",
    "white vinegar",
    "soy sauce",
  ],
  Baking: [
    "all-purpose flour",
    "sugar",
    "brown sugar",
    "baking powder",
    "baking soda",
    "vanilla extract",
  ],
  Basics: ["butter", "eggs", "rice", "pasta"],
};
