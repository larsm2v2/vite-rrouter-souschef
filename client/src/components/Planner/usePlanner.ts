import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import apiClient from "../pages/Client";
import { useToast } from "../common/Toast";
import { useUndoable } from "../../hooks/useUndoable";
import type { RecipeModel } from "../../types";
import {
  MEAL_TYPES,
  addDays,
  daysBetween,
  localToday,
  weekStartFor,
  type MealType,
} from "../../utils/mealPlanWeeks";
import type { SlotRef } from "../../utils/leftovers";
import {
  apiErrorMessage,
  type CompletionResult,
  type MealPlanEntry,
  type PlannerSettingsData,
} from "./plannerTypes";

const DEFAULT_SETTINGS: PlannerSettingsData = {
  weekStartDay: 1,
  favoriteThreshold: 3,
  visibleSlots: ["dinner"],
  householdSize: 2,
};

export const MAX_CUSTOM_DAYS = 42;

interface Range {
  start: string;
  end: string;
}

/** Entries from the API, normalized so older rows always have every field. */
function withDefaults(entry: MealPlanEntry): MealPlanEntry {
  return {
    ...entry,
    kind: entry.kind ?? "meal",
    sourceEntryId: entry.sourceEntryId ?? null,
    multiplier: entry.multiplier ?? 1,
    leftoverCount: entry.leftoverCount ?? 0,
  };
}

export function usePlanner() {
  const { showToast } = useToast();
  const undoable = useUndoable();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [recipes, setRecipes] = useState<RecipeModel[]>([]);
  const [anchor, setAnchor] = useState(() => localToday());
  const [customRange, setCustomRange] = useState<Range | null>(null);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const range: Range = useMemo(() => {
    if (customRange) return customRange;
    const start = weekStartFor(anchor, settings.weekStartDay);
    return { start, end: addDays(start, 6) };
  }, [anchor, customRange, settings.weekStartDay]);

  // Hidden slots that already hold meals stay visible so nothing is ever hidden.
  const slots: MealType[] = useMemo(() => {
    const used = new Set(entries.map((entry) => entry.mealType ?? "dinner"));
    return MEAL_TYPES.filter(
      (slot) => settings.visibleSlots.includes(slot) || used.has(slot),
    );
  }, [settings.visibleSlots, entries]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settingsResp, recipesResp] = await Promise.all([
          apiClient.get<PlannerSettingsData>("/api/planner/settings"),
          apiClient.get<RecipeModel[]>("/api/recipes"),
        ]);
        if (cancelled) return;
        setSettings({ ...DEFAULT_SETTINGS, ...settingsResp.data });
        if (Array.isArray(recipesResp.data)) setRecipes(recipesResp.data);
      } catch {
        if (!cancelled) setError("Could not load your planner");
      } finally {
        if (!cancelled) setSettingsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEntries = useCallback(async (target: Range) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient.get<MealPlanEntry[]>("/api/meal-plan", {
        params: target,
      });
      if (id === requestId.current) setEntries(resp.data.map(withDefaults));
    } catch {
      if (id === requestId.current) setError("Could not load this period");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (settingsLoaded) void loadEntries(range);
  }, [settingsLoaded, range, loadEntries]);

  const span = daysBetween(range.start, range.end) + 1;
  const goPrev = () =>
    customRange
      ? setCustomRange({
          start: addDays(customRange.start, -span),
          end: addDays(customRange.end, -span),
        })
      : setAnchor(addDays(anchor, -7));
  const goNext = () =>
    customRange
      ? setCustomRange({
          start: addDays(customRange.start, span),
          end: addDays(customRange.end, span),
        })
      : setAnchor(addDays(anchor, 7));
  const goToday = () => {
    setCustomRange(null);
    setAnchor(localToday());
  };
  const showWeekOf = (date: string) => {
    setCustomRange(null);
    setAnchor(date);
  };

  const applyCustomRange = (start: string, end: string): string | null => {
    const days = daysBetween(start, end) + 1;
    if (days < 1) return "The end date must not be before the start date";
    if (days > MAX_CUSTOM_DAYS)
      return `Pick a range of at most ${MAX_CUSTOM_DAYS} days`;
    setCustomRange({ start, end });
    return null;
  };

  const saveSettings = async (
    patch: Partial<PlannerSettingsData>,
  ): Promise<boolean> => {
    try {
      const resp = await apiClient.put<PlannerSettingsData>(
        "/api/planner/settings",
        patch,
      );
      setSettings({ ...DEFAULT_SETTINGS, ...resp.data });
      if (patch.favoriteThreshold !== undefined) {
        // A lower threshold can favorite recipes retroactively.
        void apiClient
          .get<RecipeModel[]>("/api/recipes")
          .then((r) => Array.isArray(r.data) && setRecipes(r.data))
          .catch(() => undefined);
      }
      return true;
    } catch (err) {
      showToast(apiErrorMessage(err, "Could not save settings"), "error");
      return false;
    }
  };

  const recordCompletion = (
    recipeId: number | null,
    completion: CompletionResult | null,
  ) => {
    if (!recipeId || !completion) return;
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === String(recipeId)
          ? {
              ...recipe,
              cook_count: completion.cookCount,
              is_favorite: completion.isFavorite,
            }
          : recipe,
      ),
    );
  };

  const addEntry = async (
    recipeId: number,
    plannedDate: string,
    mealType: MealType,
  ) => {
    const recipe = recipes.find((item) => item.id === String(recipeId));
    const tempId = -Date.now();
    const temp: MealPlanEntry = {
      id: tempId,
      clientKey: tempId,
      recipeId,
      recipeName: recipe?.name ?? null,
      plannedDate,
      mealType,
      isCooked: false,
      kind: "meal",
      sourceEntryId: null,
      multiplier: 1,
      leftoverCount: 0,
    };
    setEntries((current) => [...current, temp]);
    try {
      const resp = await apiClient.post<MealPlanEntry>("/api/meal-plan", {
        recipeId,
        plannedDate,
        mealType,
      });
      setEntries((current) =>
        current.map((entry) =>
          entry.id === tempId
            ? { ...withDefaults(resp.data), clientKey: tempId }
            : entry,
        ),
      );
    } catch {
      setEntries((current) => current.filter((entry) => entry.id !== tempId));
      showToast("Could not add that recipe to the plan", "error");
    }
  };

  // Moving a meal carries its leftovers by the same number of days (the server does the same).
  const moveEntry = async (
    id: number,
    plannedDate: string,
    mealType: MealType,
  ) => {
    const before = entries.find((entry) => entry.id === id);
    if (!before || id < 0) return;
    if (before.plannedDate === plannedDate && before.mealType === mealType)
      return;
    const delta = daysBetween(before.plannedDate, plannedDate);
    setEntries((current) =>
      current.map((entry) => {
        if (entry.id === id) return { ...entry, plannedDate, mealType };
        if (entry.sourceEntryId === id && delta !== 0)
          return { ...entry, plannedDate: addDays(entry.plannedDate, delta) };
        return entry;
      }),
    );
    try {
      await apiClient.patch(`/api/meal-plan/${id}`, { plannedDate, mealType });
    } catch (err) {
      showToast(apiErrorMessage(err, "Could not move that meal"), "error");
      void loadEntries(range);
    }
  };

  const setMultiplier = async (id: number, multiplier: number) => {
    const before = entries.find((entry) => entry.id === id);
    if (!before || id < 0 || before.kind !== "meal") return;
    const apply = (value: number) =>
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, multiplier: value } : entry,
        ),
      );
    apply(multiplier);
    try {
      await apiClient.patch(`/api/meal-plan/${id}`, { multiplier });
    } catch (err) {
      apply(before.multiplier);
      showToast(apiErrorMessage(err, "Could not change the amount"), "error");
    }
  };

  const addLeftovers = async (
    sourceId: number,
    slotsToAdd: SlotRef[],
  ): Promise<boolean> => {
    try {
      await apiClient.post(`/api/meal-plan/${sourceId}/leftovers`, {
        slots: slotsToAdd,
      });
      await loadEntries(range);
      return true;
    } catch (err) {
      showToast(apiErrorMessage(err, "Could not add leftovers"), "error");
      return false;
    }
  };

  // The server delete runs when the Undo toast closes, so Undo is a pure local revert.
  const removeEntry = (id: number) => {
    const removed = entries.find((entry) => entry.id === id);
    if (!removed || id < 0) return;
    const withLeftovers = entries.filter(
      (entry) => entry.id === id || entry.sourceEntryId === id,
    );
    const hidden = Math.max(removed.leftoverCount, withLeftovers.length - 1);
    const label =
      removed.kind === "leftover"
        ? `leftover ${removed.recipeName ?? "meal"}`
        : (removed.recipeName ?? "meal");
    undoable({
      message:
        hidden > 0
          ? `Removed ${label} and its ${hidden} leftover${hidden === 1 ? "" : "s"}`
          : `Removed ${label} from the plan`,
      apply: () =>
        setEntries((current) =>
          current.filter(
            (entry) => entry.id !== id && entry.sourceEntryId !== id,
          ),
        ),
      revert: () =>
        setEntries((current) => [
          ...current,
          ...withLeftovers.filter(
            (restored) => !current.some((entry) => entry.id === restored.id),
          ),
        ]),
      commit: async () => {
        try {
          await apiClient.delete(`/api/meal-plan/${id}`);
        } catch {
          showToast("Could not remove that meal; refreshing", "error");
          void loadEntries(range);
        }
      },
    });
  };

  const toggleCooked = async (id: number) => {
    const before = entries.find((entry) => entry.id === id);
    if (!before || id < 0) return;
    const cooked = !before.isCooked;
    const setCooked = (value: boolean) =>
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, isCooked: value } : entry,
        ),
      );
    setCooked(cooked);
    try {
      const resp = await apiClient.post<{
        entry: MealPlanEntry;
        completion: CompletionResult | null;
      }>(`/api/meal-plan/${id}/cooked`, { cooked });
      recordCompletion(before.recipeId, resp.data.completion);
      if (resp.data.completion?.autoFavorited) {
        showToast(
          `${before.recipeName ?? "This recipe"} is now a favorite (cooked ${resp.data.completion.cookCount} times)`,
          "success",
        );
      }
    } catch {
      setCooked(before.isCooked);
      showToast("Could not update that meal", "error");
    }
  };

  // Uses the card's multiplier; leftover cards deliberately have no such action.
  const addToGroceryList = async (id: number) => {
    const entry = entries.find((item) => item.id === id);
    if (!entry || !entry.recipeId || entry.kind !== "meal") return;
    try {
      const resp = await apiClient.post<{
        itemsAdded: number;
        skippedStaples?: string[];
      }>(`/api/recipes/${entry.recipeId}/add-to-grocery-list`, {
        scale: entry.multiplier,
      });
      window.dispatchEvent(new CustomEvent("groceryListUpdated"));
      const skipped = resp.data.skippedStaples ?? [];
      showToast(
        `Added ${resp.data.itemsAdded} ingredients${
          entry.multiplier !== 1 ? ` (×${entry.multiplier})` : ""
        } to your grocery list.${
          skipped.length
            ? ` Skipped ${skipped.length} staple${skipped.length === 1 ? "" : "s"} you have in stock.`
            : ""
        }`,
        "success",
      );
    } catch (err) {
      showToast(
        apiErrorMessage(err, "Could not add ingredients to the grocery list"),
        "error",
      );
    }
  };

  const copyWeekInto = async (fromStart: string, toStart: string) => {
    const resp = await apiClient.post<MealPlanEntry[]>(
      "/api/meal-plan/copy-week",
      { fromStart, toStart },
    );
    return resp.data.length;
  };

  return {
    settings,
    slots,
    recipes,
    range,
    entries,
    loading,
    error,
    isCustom: customRange !== null,
    goPrev,
    goNext,
    goToday,
    showWeekOf,
    applyCustomRange,
    saveSettings,
    addEntry,
    moveEntry,
    setMultiplier,
    addLeftovers,
    removeEntry,
    toggleCooked,
    addToGroceryList,
    copyWeekInto,
    reload: () => loadEntries(range),
  };
}
