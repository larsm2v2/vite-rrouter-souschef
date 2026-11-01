export type Quantity = number | { min: number; max: number };

const VULGAR: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};
const VULGAR_CLASS = Object.keys(VULGAR).join("");

/** One number: mixed ("1 1/2"), fraction, "1½", "½", decimal. Non-capturing. */
export const NUMBER_PATTERN = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+\s*[${VULGAR_CLASS}]|[${VULGAR_CLASS}]|\d+(?:\.\d+)?|\.\d+)`;

export function toNumber(token: string): number | null {
  const t = token.trim();
  let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (m)
    return Number(m[3]) === 0
      ? null
      : Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  m = new RegExp(`^(\\d+)\\s*([${VULGAR_CLASS}])$`).exec(t);
  if (m) return Number(m[1]) + VULGAR[m[2]];
  if (VULGAR[t] !== undefined) return VULGAR[t];
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const RANGE_SEPARATOR = String.raw`(?:\s*[-–—]\s*|\s+to\s+)`;
const PREFIX = new RegExp(
  `^\\s*(${NUMBER_PATTERN})(?:${RANGE_SEPARATOR}(${NUMBER_PATTERN}))?(?![\\d/])`,
  "i",
);

/** Parse a leading quantity ("1 1/2", "1-2", "1 to 2", "½") and return the remaining text. */
export function parseQuantityPrefix(
  text: string,
): { quantity: Quantity; rest: string } | null {
  const m = PREFIX.exec(text);
  if (!m) return null;
  const first = toNumber(m[1]);
  if (first === null) return null;
  let quantity: Quantity = first;
  if (m[2]) {
    const second = toNumber(m[2]);
    if (second === null) return null;
    if (
      second < first &&
      /^\d+\/\d+$/.test(m[2].trim()) &&
      Number.isInteger(first)
    ) {
      quantity = first + second; // "1-1/2" is one and a half, not a range
    } else if (second < first) {
      return null;
    } else {
      quantity = { min: first, max: second };
    }
  }
  return { quantity, rest: text.slice(m[0].length) };
}

const FRACTIONS: [number, string][] = [
  [0, ""],
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
  [1, ""],
];
const FRACTION_TOLERANCE = 0.03;

export function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 10) return String(Math.round(value));
  let whole = Math.floor(value);
  const frac = value - whole;
  let best = FRACTIONS[0];
  for (const candidate of FRACTIONS) {
    if (Math.abs(candidate[0] - frac) < Math.abs(best[0] - frac))
      best = candidate;
  }
  if (Math.abs(best[0] - frac) > FRACTION_TOLERANCE) {
    return String(Math.round(value * 10) / 10);
  }
  if (best[0] === 1) whole += 1;
  const symbol = best[0] === 1 ? "" : best[1];
  if (!symbol) return String(whole);
  return whole > 0 ? `${whole} ${symbol}` : symbol;
}

export function formatQuantity(quantity: Quantity): string {
  if (typeof quantity === "number") return formatNumber(quantity);
  return `${formatNumber(quantity.min)}-${formatNumber(quantity.max)}`;
}

export function scaleQuantity(quantity: Quantity, factor: number): Quantity {
  if (typeof quantity === "number") return quantity * factor;
  return { min: quantity.min * factor, max: quantity.max * factor };
}

export function quantityValue(quantity: Quantity): number {
  return typeof quantity === "number" ? quantity : quantity.max;
}
