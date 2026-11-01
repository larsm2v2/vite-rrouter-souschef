import type { ListItem } from "../types";
import {
  mergeItems,
  removeRecipeSource,
  type GroceryItem,
} from "./groceryMerge";

type Carried = GroceryItem & { id?: number; toTransfer?: boolean };

export interface IncomingItem {
  name: string;
  quantity: number;
  unit: string;
  sources?: string[];
}

let counter = 0;
const newId = () => Date.now() * 1000 + (counter++ % 1000);

const toCarried = (item: ListItem): Carried => ({
  name: item.listItem,
  quantity: item.quantity,
  unit: item.unit,
  checked: item.isDone,
  id: item.id,
  toTransfer: item.toTransfer,
  ...(item.aisle ? { aisle: item.aisle } : {}),
  ...(item.sources?.length ? { sources: item.sources } : {}),
});

const fromCarried = (item: Carried): ListItem => ({
  id: item.id ?? newId(),
  quantity: item.quantity,
  unit: item.unit,
  listItem: item.name,
  isDone: item.checked,
  toTransfer: item.toTransfer ?? false,
  ...(item.aisle ? { aisle: item.aisle } : {}),
  ...(item.sources?.length ? { sources: item.sources } : {}),
});

/** The single client-side entry point for adding items: same rules as the server. */
export function mergeIntoList(
  list: ListItem[],
  incoming: IncomingItem[],
): ListItem[] {
  const merged = mergeItems(
    list.map(toCarried),
    incoming.map((i) => ({ ...i, checked: false })),
  );
  return merged.map((item) => fromCarried(item as Carried));
}

export function removeRecipeFromList(
  list: ListItem[],
  recipeId: string,
  contributions: IncomingItem[],
): ListItem[] {
  return removeRecipeSource(
    list.map(toCarried),
    recipeId,
    contributions.map((i) => ({ ...i, checked: false })),
  ).map((item) => fromCarried(item as Carried));
}
