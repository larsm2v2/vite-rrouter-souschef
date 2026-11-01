export interface CleanGroceryItem {
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  aisle?: string;
  sources?: string[];
}

export const MAX_ITEMS = 500;
const MAX_NAME = 200;
const MAX_UNIT = 40;
const MAX_SOURCES = 50;

/** Returns cleaned items, or a message describing the first problem. Unknown fields are dropped. */
export function validateGroceryList(
  input: unknown,
): { items: CleanGroceryItem[] } | { error: string } {
  if (!Array.isArray(input)) return { error: "listData must be an array" };
  if (input.length > MAX_ITEMS)
    return { error: `listData may hold at most ${MAX_ITEMS} items` };

  const items: CleanGroceryItem[] = [];
  for (let i = 0; i < input.length; i++) {
    const raw = input[i] as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return { error: `item ${i} must be an object` };
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name || name.length > MAX_NAME)
      return { error: `item ${i} needs a name up to ${MAX_NAME} characters` };
    const quantity =
      raw.quantity === undefined || raw.quantity === null
        ? 0
        : Number(raw.quantity);
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000)
      return { error: `item ${i} has an invalid quantity` };
    const unit = raw.unit === undefined || raw.unit === null ? "" : raw.unit;
    if (typeof unit !== "string" || unit.length > MAX_UNIT)
      return { error: `item ${i} has an invalid unit` };

    const item: CleanGroceryItem = {
      name,
      quantity,
      unit,
      checked: raw.checked === true,
    };
    if (raw.aisle !== undefined && raw.aisle !== null) {
      if (typeof raw.aisle !== "string" || raw.aisle.length > MAX_UNIT)
        return { error: `item ${i} has an invalid aisle` };
      item.aisle = raw.aisle;
    }
    if (raw.sources !== undefined && raw.sources !== null) {
      if (
        !Array.isArray(raw.sources) ||
        raw.sources.length > MAX_SOURCES ||
        raw.sources.some((s) => typeof s !== "string" || s.length > MAX_UNIT)
      ) {
        return { error: `item ${i} has invalid sources` };
      }
      if (raw.sources.length > 0) item.sources = raw.sources as string[];
    }
    items.push(item);
  }
  return { items };
}
