export type UnitFamily = "volume" | "mass" | string;

export interface UnitDef {
  key: string;
  /** Convertible families are "volume" and "mass"; every other unit is its own family. */
  family: UnitFamily;
  /** Size in the family's base unit (ml or g); 1 for non-convertible units. */
  base: number;
  singular: string;
  plural: string;
}

const defs: UnitDef[] = [
  {
    key: "tsp",
    family: "volume",
    base: 4.92892159375,
    singular: "tsp",
    plural: "tsp",
  },
  {
    key: "tbsp",
    family: "volume",
    base: 14.78676478125,
    singular: "tbsp",
    plural: "tbsp",
  },
  {
    key: "floz",
    family: "volume",
    base: 29.5735295625,
    singular: "fl oz",
    plural: "fl oz",
  },
  {
    key: "cup",
    family: "volume",
    base: 236.5882365,
    singular: "cup",
    plural: "cups",
  },
  {
    key: "pint",
    family: "volume",
    base: 473.176473,
    singular: "pint",
    plural: "pints",
  },
  {
    key: "quart",
    family: "volume",
    base: 946.352946,
    singular: "quart",
    plural: "quarts",
  },
  {
    key: "gallon",
    family: "volume",
    base: 3785.411784,
    singular: "gallon",
    plural: "gallons",
  },
  { key: "ml", family: "volume", base: 1, singular: "ml", plural: "ml" },
  { key: "l", family: "volume", base: 1000, singular: "l", plural: "l" },
  { key: "g", family: "mass", base: 1, singular: "g", plural: "g" },
  { key: "kg", family: "mass", base: 1000, singular: "kg", plural: "kg" },
  {
    key: "oz",
    family: "mass",
    base: 28.349523125,
    singular: "oz",
    plural: "oz",
  },
  { key: "lb", family: "mass", base: 453.59237, singular: "lb", plural: "lb" },
];

const countUnits: [string, string, string][] = [
  ["clove", "clove", "cloves"],
  ["can", "can", "cans"],
  ["slice", "slice", "slices"],
  ["piece", "piece", "pieces"],
  ["bunch", "bunch", "bunches"],
  ["pinch", "pinch", "pinches"],
  ["dash", "dash", "dashes"],
  ["stick", "stick", "sticks"],
  ["package", "package", "packages"],
  ["head", "head", "heads"],
  ["sprig", "sprig", "sprigs"],
  ["stalk", "stalk", "stalks"],
];
for (const [key, singular, plural] of countUnits) {
  defs.push({ key, family: key, base: 1, singular, plural });
}

export const UNITS: Record<string, UnitDef> = defs.reduce<
  Record<string, UnitDef>
>((acc, d) => {
  acc[d.key] = d;
  return acc;
}, {});

const aliasTable: Record<string, string> = {
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tbs: "tbsp",
  tbl: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  "fl oz": "floz",
  "fl. oz": "floz",
  "fluid ounce": "floz",
  "fluid ounces": "floz",
  cup: "cup",
  cups: "cup",
  pint: "pint",
  pints: "pint",
  pt: "pint",
  quart: "quart",
  quarts: "quart",
  qt: "quart",
  gallon: "gallon",
  gallons: "gallon",
  gal: "gallon",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  g: "g",
  gram: "g",
  grams: "g",
  gr: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kgs: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  pkg: "package",
  pkgs: "package",
};
for (const [key, singular, plural] of countUnits) {
  aliasTable[singular] = key;
  aliasTable[plural] = key;
}
aliasTable.bunches = "bunch";
aliasTable.pinches = "pinch";
aliasTable.dashes = "dash";

/** Canonical unit key for a written unit, or null when the word is not a known unit. */
export function canonicalUnit(word: string): string | null {
  const cleaned = word.trim().toLowerCase().replace(/\.$/, "");
  return aliasTable[cleaned] ?? null;
}

export function isConvertible(from: string | null, to: string | null): boolean {
  if (!from || !to) return false;
  const a = UNITS[from];
  const b = UNITS[to];
  return Boolean(
    a &&
    b &&
    a.family === b.family &&
    (a.family === "volume" || a.family === "mass"),
  );
}

/** Convert within a family. Returns null when the units are not convertible. */
export function convert(
  value: number,
  from: string,
  to: string,
): number | null {
  if (from === to) return value;
  if (!isConvertible(from, to)) return null;
  return (value * UNITS[from].base) / UNITS[to].base;
}

export function unitLabel(key: string | null, quantity: number): string {
  if (!key) return "";
  const def = UNITS[key];
  if (!def) return key;
  return quantity > 1 ? def.plural : def.singular;
}
