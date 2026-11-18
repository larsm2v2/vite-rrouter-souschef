import type { StockedItem } from "../types";

export interface StockedGroup<T extends StockedItem> {
  /** null is the "Uncategorized" bucket, always last. */
  category: string | null;
  items: T[];
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export function hasStockedName(items: StockedItem[], name: string): boolean {
  return items.some((item) => sameName(item.name, name));
}

/** Groups by category (case-insensitive, first spelling wins), A-Z, uncategorized last. Order within a group is preserved. */
export function groupByCategory<T extends StockedItem>(
  items: T[],
): StockedGroup<T>[] {
  const groups = new Map<string, StockedGroup<T>>();
  for (const item of items) {
    const label = item.category?.trim() || null;
    const key = label?.toLowerCase() ?? "";
    const group = groups.get(key) ?? { category: label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.category === null) return 1;
    if (b.category === null) return -1;
    return a.category.localeCompare(b.category);
  });
}

/** Toast text after adding a recipe to the grocery list, mentioning any in-stock staples that were skipped. */
export function groceryAddedMessage(
  itemsAdded: number,
  skippedStaples: string[] = [],
): string {
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`;
  const added = `Added ${plural(itemsAdded, "ingredient")} to your grocery list.`;
  if (skippedStaples.length === 0) return added;
  return `${added} Skipped ${plural(skippedStaples.length, "staple")} you have in stock: ${skippedStaples.join(", ")}.`;
}

/** Distinct, sorted category names from the user's items plus any extras (e.g. the starter suggestions). */
export function categoryOptions(
  items: StockedItem[],
  extra: string[] = [],
): string[] {
  const seen = new Map<string, string>();
  for (const label of [...items.map((i) => i.category ?? ""), ...extra]) {
    const trimmed = label.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.set(trimmed.toLowerCase(), trimmed);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
