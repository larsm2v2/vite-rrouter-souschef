import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import "./AlreadyStocked.css";
import { StockedItem } from "../../types";
import apiClient from "../pages/Client";
import { useToast } from "../common/Toast";
import {
  categoryOptions,
  groupByCategory,
  hasStockedName,
} from "../../utils/stockedItems";

interface AlreadyStockedProps {
  onAddToGroceryList?: (items: StockedItem[]) => void;
}

// Rows get a stable id so inputs keep their identity while items move between category groups.
type Row = StockedItem & { uid: number };

type LoadState = "loading" | "ready" | "error";

const RUNNING_LOW_HINT =
  "Running-low staples are included when you add recipes to your grocery list.";
const CATEGORY_LIST_ID = "already-stocked-categories";
const DEBOUNCE_MS = 500;
const PICK_SEPARATOR = "\u0000";

let nextUid = 1;

/** Reuses ids of rows that are still present (matched by name) so the UI doesn't remount. */
function toRows(items: StockedItem[], previous: Row[] = []): Row[] {
  const known = new Map(
    previous.map((row) => [row.name.trim().toLowerCase(), row.uid]),
  );
  return items.map((item) => ({
    ...item,
    uid: known.get(item.name.trim().toLowerCase()) ?? nextUid++,
  }));
}

function itemOf(row: Row): StockedItem {
  const item: StockedItem = { name: row.name };
  if (row.quantity !== undefined) item.quantity = row.quantity;
  if (row.unit !== undefined) item.unit = row.unit;
  if (row.category) item.category = row.category;
  if (row.runningLow) item.runningLow = true;
  return item;
}

const itemsOf = (rows: Row[]) => rows.map(itemOf);
const serialize = (items: StockedItem[]) => JSON.stringify(items);

const StockedRow: React.FC<{
  row: Row;
  onName: (name: string) => void;
  onCategory: (category: string) => void;
  onRunningLow: (runningLow: boolean) => void;
  onDelete: () => void;
}> = ({ row, onName, onCategory, onRunningLow, onDelete }) => {
  // Committed on blur/Enter: changing it moves the row to another group, which would remount it mid-typing.
  const [categoryDraft, setCategoryDraft] = useState(row.category ?? "");
  const commitCategory = () => {
    if (categoryDraft.trim() !== (row.category ?? "")) {
      onCategory(categoryDraft);
    }
  };

  return (
    <div className={`stocked-item${row.runningLow ? " running-low" : ""}`}>
      <div className="stocked-details">
        <input
          type="text"
          value={row.name}
          maxLength={100}
          aria-label="Item name"
          onChange={(e) => onName(e.target.value)}
          className="stocked-edit-input"
        />
        <input
          type="text"
          value={categoryDraft}
          maxLength={40}
          list={CATEGORY_LIST_ID}
          placeholder="Category"
          aria-label={`Category for ${row.name}`}
          onChange={(e) => setCategoryDraft(e.target.value)}
          onBlur={commitCategory}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitCategory();
            }
          }}
          className="stocked-category-input"
        />
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!row.runningLow}
        className={`running-low-toggle${row.runningLow ? " on" : ""}`}
        onClick={() => onRunningLow(!row.runningLow)}
        title={RUNNING_LOW_HINT}
        aria-label={`Running low: ${row.name}. ${RUNNING_LOW_HINT}`}
      >
        Running low
      </button>
      <button
        type="button"
        className="delete-stocked-btn"
        onClick={onDelete}
        title="Delete"
        aria-label={`Delete ${row.name}`}
      >
        ✕
      </button>
    </div>
  );
};

const AlreadyStocked: React.FC<AlreadyStockedProps> = ({
  onAddToGroceryList,
}) => {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [formError, setFormError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");

  const [showStarter, setShowStarter] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<
    string,
    string[]
  > | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(false);
  // key (category + lowercase name) -> display name
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [addingStarter, setAddingStarter] = useState(false);

  const saveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  // What the server is known to hold; autosave only runs when the list differs from it.
  const syncedRef = useRef<string | null>(null);
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;

  const persist = useCallback((items: StockedItem[]) => {
    const json = serialize(items);
    const run = async () => {
      try {
        await apiClient.post("/api/already-stocked", { stockedItems: items });
        syncedRef.current = json;
        setSaveError(false);
      } catch {
        console.error("Failed to persist already stocked items");
        setSaveError(true);
      }
    };
    // Keeps writes in order so a slow earlier save can't overwrite a newer one.
    saveQueueRef.current = saveQueueRef.current.then(run);
    return saveQueueRef.current;
  }, []);

  const isDirty = useCallback(
    () =>
      syncedRef.current !== null &&
      serialize(itemsOf(rowsRef.current)) !== syncedRef.current,
    [],
  );

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    if (isDirty()) await persist(itemsOf(rowsRef.current));
  }, [isDirty, persist]);

  const fetchAlreadyStocked = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await apiClient.get<{ stockedItems?: StockedItem[] }>(
        "/api/already-stocked",
      );
      const items = response.data.stockedItems ?? [];
      syncedRef.current = serialize(items);
      setRows(toRows(items));
      setLoadState("ready");
    } catch {
      console.error("Error fetching already stocked items");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    fetchAlreadyStocked();
  }, [fetchAlreadyStocked]);

  // Debounced autosave; never runs before the first successful load.
  useEffect(() => {
    if (loadState !== "ready") return;
    const items = itemsOf(rows);
    if (serialize(items) === syncedRef.current) return;

    const timerId = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persist(items);
    }, DEBOUNCE_MS);
    saveTimerRef.current = timerId;
    return () => window.clearTimeout(timerId);
  }, [rows, loadState, persist]);

  // Don't lose an edit made just before navigating away.
  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (isDirty()) void persist(itemsOf(rowsRef.current));
    },
    [isDirty, persist],
  );

  const items = useMemo(() => itemsOf(rows), [rows]);
  const groups = useMemo(() => groupByCategory(rows), [rows]);
  const categories = useMemo(
    () => categoryOptions(items, Object.keys(suggestions ?? {})),
    [items, suggestions],
  );

  const updateRow = (uid: number, patch: Partial<StockedItem>) =>
    setRows((prev) =>
      prev.map((row) => (row.uid === uid ? { ...row, ...patch } : row)),
    );

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newItemName.trim();
    if (!name) {
      setFormError("Item name cannot be empty");
      return;
    }
    if (hasStockedName(items, name)) {
      setFormError(`${name} is already in your list`);
      return;
    }
    const category = newItemCategory.trim();
    setRows((prev) => [
      ...prev,
      { uid: nextUid++, name, ...(category ? { category } : {}) },
    ]);
    setNewItemName("");
    setFormError(null);
  };

  const handleRunningLow = (row: Row, runningLow: boolean) => {
    updateRow(row.uid, { runningLow });
    if (runningLow) {
      // Puts it back on the grocery list right away.
      window.dispatchEvent(
        new CustomEvent("addAlreadyStockedToGrocery", {
          detail: [{ ...itemOf(row), runningLow: true }],
        }),
      );
    }
  };

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    setSuggestionsError(false);
    try {
      const response = await apiClient.get<{
        categories?: Record<string, string[]>;
      }>("/api/already-stocked/suggestions");
      setSuggestions(response.data.categories ?? {});
    } catch {
      setSuggestionsError(true);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  const toggleStarter = () => {
    const next = !showStarter;
    setShowStarter(next);
    if (next && !suggestions && !suggestionsLoading) void loadSuggestions();
  };

  const pickKey = (category: string, name: string) =>
    `${category}${PICK_SEPARATOR}${name.toLowerCase()}`;

  const togglePick = (category: string, name: string) =>
    setPicked((prev) => {
      const key = pickKey(category, name);
      const next = { ...prev };
      if (key in next) delete next[key];
      else next[key] = name;
      return next;
    });

  const togglePickCategory = (category: string, names: string[]) => {
    const selectable = names.filter((n) => !hasStockedName(items, n));
    const allPicked = selectable.every((n) => pickKey(category, n) in picked);
    setPicked((prev) => {
      const next = { ...prev };
      for (const name of selectable) {
        if (allPicked) delete next[pickKey(category, name)];
        else next[pickKey(category, name)] = name;
      }
      return next;
    });
  };

  const handleAddStarter = async () => {
    const toAdd = Object.entries(picked).map(([key, name]) => ({
      name,
      category: key.split(PICK_SEPARATOR)[0],
    }));
    if (toAdd.length === 0) return;
    setAddingStarter(true);
    try {
      // Save pending edits first so the merged list the server returns includes them.
      await flushPendingSave();
      const response = await apiClient.post<{ stockedItems?: StockedItem[] }>(
        "/api/already-stocked/items",
        { items: toAdd },
      );
      const saved = response.data.stockedItems ?? [];
      const added = saved.filter((s) => !hasStockedName(items, s.name)).length;
      // Marked as synced so the autosave effect doesn't write the same list straight back.
      syncedRef.current = serialize(saved);
      setRows((prev) => toRows(saved, prev));
      setPicked({});
      showToast(
        added > 0
          ? `Added ${added} staple${added === 1 ? "" : "s"}`
          : "Those staples were already in your list",
        "success",
      );
    } catch {
      showToast("Couldn't add starter staples. Please try again.", "error");
    } finally {
      setAddingStarter(false);
    }
  };

  const handleAddAllToGrocery = () => {
    if (onAddToGroceryList) {
      onAddToGroceryList(items);
    }
  };

  if (loadState === "loading") {
    return (
      <div className="already-stocked-container">
        Loading already stocked items...
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="already-stocked-container">
        <div className="error-message" role="alert">
          Failed to load already stocked items. Your saved list hasn't been
          changed.
        </div>
        <button
          type="button"
          className="add-stocked-btn"
          onClick={fetchAlreadyStocked}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="already-stocked-container">
      <div className="already-stocked-header">
        <h2>Already Stocked</h2>
        <div className="already-stocked-header-actions">
          <button
            type="button"
            className="starter-btn"
            onClick={toggleStarter}
            aria-expanded={showStarter}
          >
            Starter staples
          </button>
          <button
            className="add-all-btn"
            onClick={handleAddAllToGrocery}
            disabled={rows.length === 0}
          >
            Add All to Grocery List
          </button>
        </div>
      </div>

      {formError && (
        <div className="error-message" role="alert">
          {formError}
        </div>
      )}
      {saveError && (
        <div className="error-message" role="alert">
          Couldn't save your latest changes. We'll retry on your next edit.
        </div>
      )}

      {showStarter && (
        <section className="starter-panel" aria-label="Starter staples">
          <p className="stocked-hint">
            Pick common pantry items you always keep. Recipes won't add these to
            your grocery list.
          </p>
          {suggestionsLoading && <p>Loading suggestions...</p>}
          {suggestionsError && (
            <div className="error-message" role="alert">
              Couldn't load suggestions.{" "}
              <button
                type="button"
                className="link-btn"
                onClick={loadSuggestions}
              >
                Try again
              </button>
            </div>
          )}
          {suggestions &&
            Object.entries(suggestions).map(([category, names]) => {
              const selectable = names.filter((n) => !hasStockedName(items, n));
              const allPicked =
                selectable.length > 0 &&
                selectable.every((n) => pickKey(category, n) in picked);
              return (
                <fieldset key={category} className="starter-category">
                  <legend>{category}</legend>
                  {selectable.length > 0 && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => togglePickCategory(category, names)}
                    >
                      {allPicked ? "Clear all" : "Select all"}
                    </button>
                  )}
                  <div className="starter-options">
                    {names.map((name) => {
                      const present = hasStockedName(items, name);
                      return (
                        <label
                          key={name}
                          className={`starter-option${present ? " present" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={
                              present || pickKey(category, name) in picked
                            }
                            disabled={present}
                            onChange={() => togglePick(category, name)}
                          />
                          <span>{name}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          {suggestions && (
            <button
              type="button"
              className="add-stocked-btn"
              onClick={handleAddStarter}
              disabled={addingStarter || Object.keys(picked).length === 0}
            >
              {addingStarter
                ? "Adding..."
                : `Add ${Object.keys(picked).length} selected`}
            </button>
          )}
        </section>
      )}

      <form onSubmit={handleAddItem} className="already-stocked-form">
        <input
          type="text"
          placeholder="Add item name..."
          aria-label="New item name"
          value={newItemName}
          maxLength={100}
          onChange={(e) => setNewItemName(e.target.value)}
          className="already-stocked-input"
        />
        <input
          type="text"
          placeholder="Category (optional)"
          aria-label="New item category"
          list={CATEGORY_LIST_ID}
          value={newItemCategory}
          maxLength={40}
          onChange={(e) => setNewItemCategory(e.target.value)}
          className="already-stocked-input"
        />
        <button type="submit" className="add-stocked-btn">
          Add
        </button>
      </form>

      <datalist id={CATEGORY_LIST_ID}>
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      <div className="already-stocked-list">
        {rows.length === 0 ? (
          <p className="no-stocked">
            No items added yet. Add one above or pick some starter staples!
          </p>
        ) : (
          <>
            <p className="stocked-hint">{RUNNING_LOW_HINT}</p>
            {groups.map((group) => (
              <section
                key={group.category?.toLowerCase() ?? "__uncategorized"}
                className="stocked-group"
                aria-label={group.category ?? "Uncategorized"}
              >
                <h3 className="stocked-group-title">
                  {group.category ?? "Uncategorized"}{" "}
                  <span className="stocked-group-count">
                    {group.items.length}
                  </span>
                </h3>
                {group.items.map((row) => (
                  <StockedRow
                    key={`${row.uid}:${row.category ?? ""}`}
                    row={row}
                    onName={(name) => updateRow(row.uid, { name })}
                    onCategory={(category) =>
                      updateRow(row.uid, {
                        category: category.trim() || undefined,
                      })
                    }
                    onRunningLow={(low) => handleRunningLow(row, low)}
                    onDelete={() =>
                      setRows((prev) => prev.filter((r) => r.uid !== row.uid))
                    }
                  />
                ))}
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default AlreadyStocked;
