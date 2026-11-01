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
  // Lists saved before sources existed carry no tags; then fall back to untagged lines.
  const tracked = list.some(
    (line) => line.sources && line.sources.indexOf(recipeId) !== -1,
  );
  const out: GroceryItem[] = [];
  for (const line of list) {
    const legacy = !tracked && (!line.sources || line.sources.length === 0);
    if (!legacy && (!line.sources || line.sources.indexOf(recipeId) === -1)) {
      out.push(line);
      continue;
    }
    const part = contributions.find((c) => sameLine(c, line));
    if (legacy && !part) {
      out.push(line);
      continue;
    }
    const sources = (line.sources ?? []).filter((s) => s !== recipeId);
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

function fingerprint(item: GroceryItem): string {
  return JSON.stringify([
    item.name,
    round4(item.quantity),
    item.unit,
    item.checked,
    item.aisle ?? "",
    (item.sources ?? []).slice().sort(),
  ]);
}

function indexByKey(list: GroceryItem[]) {
  const counts: Record<string, number> = Object.create(null);
  const map: Record<string, GroceryItem> = Object.create(null);
  const keys: string[] = [];
  for (const item of list) {
    const base = normalizeName(item.name) + "|" + unitKey(item.unit);
    counts[base] = (counts[base] || 0) + 1;
    const key = base + "#" + counts[base];
    keys.push(key);
    map[key] = item;
  }
  return { keys, map };
}

function mergeLine(
  base: GroceryItem,
  local: GroceryItem,
  server: GroceryItem,
): GroceryItem {
  // Both sides' quantity changes apply, so a bump here and a recipe added there both count.
  const quantity = round4(
    Math.max(0, server.quantity + (local.quantity - base.quantity)),
  );
  const added = (local.sources ?? []).filter(
    (s) => (base.sources ?? []).indexOf(s) === -1,
  );
  const removed = (base.sources ?? []).filter(
    (s) => (local.sources ?? []).indexOf(s) === -1,
  );
  const sources = Array.from(
    new Set((server.sources ?? []).concat(added)),
  ).filter((s) => removed.indexOf(s) === -1);
  const aisle = local.aisle !== base.aisle ? local.aisle : server.aisle;
  return {
    ...server,
    name: local.name !== base.name ? local.name : server.name,
    quantity,
    unit: withUnitLabel(server.unit, quantity),
    checked: local.checked !== base.checked ? local.checked : server.checked,
    ...(aisle ? { aisle } : { aisle: undefined }),
    ...(sources.length ? { sources } : { sources: undefined }),
  };
}

/**
 * Three-way merge after a save conflict: `base` is what this client last synced,
 * `local` is its unsaved list, `server` is the list that won. Nothing either side
 * added or changed is lost; when both edited the same field, the local value wins.
 */
export function mergeConflict(
  base: GroceryItem[],
  local: GroceryItem[],
  server: GroceryItem[],
): GroceryItem[] {
  const b = indexByKey(base);
  const l = indexByKey(local);
  const s = indexByKey(server);
  const seen: Record<string, boolean> = Object.create(null);
  const out: GroceryItem[] = [];
  for (const key of s.keys.concat(l.keys)) {
    if (seen[key]) continue;
    seen[key] = true;
    const B = b.map[key];
    const L = l.map[key];
    const S = s.map[key];
    if (B && L && S) out.push(mergeLine(B, L, S));
    else if (B && L) {
      // Server deleted it: keep only if this client changed it.
      if (fingerprint(L) !== fingerprint(B)) out.push(L);
    } else if (B && S) {
      // This client deleted it: keep only if the server changed it.
      if (fingerprint(S) !== fingerprint(B)) out.push(S);
    } else if (L && S) {
      out.push(fingerprint(L) === fingerprint(S) ? S : mergeItems([S], [L])[0]);
    } else if (L) out.push(L);
    else if (S) out.push(S);
  }
  return out;
}
