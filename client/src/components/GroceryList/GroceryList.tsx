import React, { useState, useEffect, useCallback, useRef } from "react";
import "./GroceryList.css";
import { RecipeModel } from "../../types";
import EditableList from "./EditableList/EditableList";
import { ListItem } from "../../types";
import apiClient from "../pages/Client";
import { useToast } from "../common/Toast";
import { COPY_GROCERY_EVENT } from "./groceryEvents";
import {
  mergeIntoList,
  removeRecipeFromList,
  type IncomingItem,
} from "../../utils/groceryAdapter";
import { normalizeApiIngredient } from "../../utils/recipeMath";
import { quantityValue, formatNumber } from "../../utils/recipeMath/quantity";
import { useUndoable } from "../../hooks/useUndoable";
import { mergeConflict, type GroceryItem } from "../../utils/groceryMerge";

interface BackendItem {
  quantity?: number;
  unit?: string;
  name?: string;
  checked?: boolean;
  aisle?: string;
  sources?: string[];
}

interface BackendList {
  version?: number;
  listData?: BackendItem[];
}

function toGroceryItems(listData: BackendItem[]): GroceryItem[] {
  return listData.map((item) => ({
    name: item.name || "",
    quantity: item.quantity || 0,
    unit: item.unit || "",
    checked: item.checked || false,
    ...(item.aisle ? { aisle: item.aisle } : {}),
    ...(item.sources?.length ? { sources: item.sources } : {}),
  }));
}

function fromBackend(listData: BackendItem[]): ListItem[] {
  return listData.map((item, index) => ({
    id: index,
    quantity: item.quantity || 0,
    unit: item.unit || "",
    listItem: item.name || "",
    isDone: item.checked || false,
    toTransfer: false,
    ...(item.aisle ? { aisle: item.aisle } : {}),
    ...(item.sources?.length ? { sources: item.sources } : {}),
  }));
}

/** Backend format; aisle and sources ride along so autosave never drops them. */
function toPayload(items: ListItem[]) {
  return {
    listData: items.map((item) => ({
      name: item.listItem,
      quantity: item.quantity,
      unit: item.unit,
      checked: item.isDone,
      ...(item.aisle ? { aisle: item.aisle } : {}),
      ...(item.sources?.length ? { sources: item.sources } : {}),
    })),
  };
}

/** One recipe's ingredients as list items (strings and structured ingredients alike). */
function contributionsFor(recipe: RecipeModel): IncomingItem[] {
  const out: IncomingItem[] = [];
  for (const group of Object.values(recipe.ingredients ?? {})) {
    if (!Array.isArray(group)) continue;
    for (const entry of group) {
      const ing = normalizeApiIngredient(entry as string | { name?: string });
      const name = (ing.name || ing.raw).trim();
      if (!name) continue;
      out.push({
        name,
        quantity: ing.quantity === null ? 0 : quantityValue(ing.quantity),
        unit: ing.unit ?? "",
        sources: [String(recipe.id)],
      });
    }
  }
  return out;
}

interface GroceryListProps {
  selectedRecipeIds: string[];
}

// Fetch recipe by ID (from the imported Recipes.json)
/* const fetchRecipeById = (recipeId: string): RecipeModel | null => {
	const recipe = (recipeData as RecipeModel[]).find(
		(recipe) => recipe.id === recipeId
	)
	if (!recipe) return null

	const fixedRecipe = {
		...recipe,
		"serving info": {
			...recipe["serving info"],
			"prep time": recipe["serving info"]["prep time"] || "", // Replace null with empty string
			"total time": recipe["serving info"]["total time"] || "", // Replace null with empty string
			"number of people served":
				parseInt(
					recipe["serving info"]["number of people served"] as string,
					10
				) || 0, // Convert to number or default to 0
		},
	}

	return fixedRecipe as RecipeModel
} */
const GroceryList: React.FC<GroceryListProps> = ({
  selectedRecipeIds = [],
}) => {
  const { showToast } = useToast();
  const undoable = useUndoable();
  const previousSelectedRecipeIds = useRef([...selectedRecipeIds]);
  const [recipes, setRecipes] = useState<RecipeModel[]>([]);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const versionRef = useRef<number>(0);
  const loadedRef = useRef(false);
  const loadErrorShownRef = useRef(false);
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const buildKeepText = () =>
    listItems
      .filter((item) => !item.isDone)
      .map((item) =>
        `${item.quantity > 0 ? formatNumber(item.quantity) : ""} ${item.unit || ""} ${item.listItem}`
          .replace(/\s+/g, " ")
          .trim(),
      )
      .join("\n");

  // Fetch backend grocery list version
  const fetchGroceryList = useCallback(async () => {
    try {
      const response = await apiClient.get<{
        id: number;
        userId: number;
        version: number;
        listData: {
          quantity?: number;
          unit?: string;
          name?: string;
          checked?: boolean;
          aisle?: string;
          sources?: string[];
        }[];
        createdAt: string;
        isCurrent: boolean;
      }>("/api/grocery-list/version");

      if (response.status === 200) {
        // A user with no saved list yet gets null: that is a successful load of an empty list.
        const data = response.data;
        const backendItems = fromBackend(data?.listData ?? []);
        versionRef.current = data?.version ?? 0;
        loadedRef.current = true;
        loadErrorShownRef.current = false;
        // What the server already has must not be saved back as a new version.
        lastSavedRef.current = JSON.stringify(toPayload(backendItems));
        setListItems(backendItems);
      }
    } catch {
      console.error("Error fetching grocery list");
      // Never autosave over a list we could not read.
      if (!loadedRef.current && !loadErrorShownRef.current) {
        loadErrorShownRef.current = true;
        showToast(
          "Could not load your grocery list. Changes will not be saved until it loads.",
          "error",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const copyForGoogleKeep = async () => {
    const text = buildKeepText();
    if (!text) {
      showToast("No unchecked items to copy", "info");
      return;
    }
    const count = text.split("\n").length;

    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${count} items!`, "success");
    } catch {
      console.error("Failed to copy grocery list");
      showToast("Could not access the clipboard", "error");
    }
  };

  const shareGroceryList = async () => {
    const text = buildKeepText();
    if (!text) {
      showToast("No unchecked items to share", "info");
      return;
    }
    try {
      await navigator.share({ title: "Grocery list", text });
    } catch (err) {
      // Dismissing the share sheet is not an error.
      if ((err as DOMException)?.name !== "AbortError") {
        showToast("Could not open the share sheet", "error");
      }
    }
  };

  // Let controls outside the drawer (navbar, mobile dock) trigger a copy.
  const copyRef = useRef(copyForGoogleKeep);
  useEffect(() => {
    copyRef.current = copyForGoogleKeep;
  });
  useEffect(() => {
    const handler = () => void copyRef.current();
    window.addEventListener(COPY_GROCERY_EVENT, handler);
    return () => window.removeEventListener(COPY_GROCERY_EVENT, handler);
  }, []);

  useEffect(() => {
    fetchGroceryList();
  }, [fetchGroceryList]);

  // Persist grocery list edits/deletions by creating a new backend version
  useEffect(() => {
    if (loading) return; // don't persist during initial load

    // Debounce rapid changes to avoid spamming the server
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    const timerId = window.setTimeout(async () => {
      if (!loadedRef.current) return; // never overwrite a list we failed to read
      try {
        const payload = toPayload(listItems);
        const serialized = JSON.stringify(payload);
        // Skip no-op saves; refetching our own save used to create a new version every cycle.
        if (serialized === lastSavedRef.current) return;

        // baseVersion makes the server refuse to overwrite a list that changed in the meantime.
        const resp = await apiClient.post<{ version: number }>(
          "/api/grocery-list/version",
          { ...payload, baseVersion: versionRef.current },
        );
        if (resp.status >= 200 && resp.status < 300) {
          lastSavedRef.current = serialized;
          if (typeof resp.data?.version === "number")
            versionRef.current = resp.data.version;
        }
      } catch (error) {
        const conflict = (
          error as {
            response?: { status?: number; data?: { current?: BackendList } };
          }
        )?.response;
        if (conflict?.status === 409) {
          // Someone else (another tab or an added recipe) saved first: merge their list with this edit.
          const current = conflict.data?.current;
          const server = toGroceryItems(current?.listData ?? []);
          const base = toGroceryItems(
            (JSON.parse(lastSavedRef.current ?? '{"listData":[]}') as BackendList)
              .listData ?? [],
          );
          const local = toGroceryItems(toPayload(listItems).listData);
          versionRef.current = current?.version ?? 0;
          lastSavedRef.current = JSON.stringify(toPayload(fromBackend(server)));
          // A changed list re-runs the save effect, now based on the server's version.
          setListItems(fromBackend(mergeConflict(base, local, server)));
          showToast(
            "Your grocery list was also changed elsewhere. Your change was merged with it.",
            "info",
          );
        } else {
          console.error("Failed to persist grocery list changes");
        }
      }
    }, 500); // 500ms debounce
    saveTimerRef.current = timerId;

    // Cleanup if list changes again quickly
    return () => {
      window.clearTimeout(timerId);
    };
  }, [listItems, loading, showToast]);

  // Listen for custom event when grocery list is updated
  useEffect(() => {
    const handleGroceryListUpdate = () => {
      console.log("Grocery list update event received, refreshing...");
      fetchGroceryList();
    };

    window.addEventListener("groceryListUpdated", handleGroceryListUpdate);

    return () => {
      window.removeEventListener("groceryListUpdated", handleGroceryListUpdate);
    };
  }, [fetchGroceryList]);

  // Listen for already stocked items to be added to grocery list
  useEffect(() => {
    const handleAddAlreadyStockedToGrocery = (event: Event) => {
      const customEvent = event as CustomEvent;
      const stockedItems = customEvent.detail;
      if (Array.isArray(stockedItems)) {
        const incoming: IncomingItem[] = stockedItems
          .filter((item: { name?: string }) => typeof item?.name === "string")
          .map((item: { name: string; quantity?: number; unit?: string }) => ({
            name: item.name,
            quantity: Number(item.quantity) || 0,
            unit: item.unit || "",
          }));
        setListItems((prevItems) => mergeIntoList(prevItems, incoming));
      }
    };

    window.addEventListener(
      "addAlreadyStockedToGrocery",
      handleAddAlreadyStockedToGrocery,
    );

    return () => {
      window.removeEventListener(
        "addAlreadyStockedToGrocery",
        handleAddAlreadyStockedToGrocery,
      );
    };
  }, []);

  //Fetch Backend Recipes
  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const response = await apiClient.get<RecipeModel[]>(`/api/recipes`);

        if (response.status === 200) {
          setRecipes(response.data); // Update recipes state
        } else {
          throw new Error("Failed to fetch recipes.");
        }
      } catch {
        console.error("Error fetching recipes");
      }
    };

    fetchRecipes(); // Fetch recipes on component mount
  }, []);
  // Helper function to consolidate ingredients
  /* 	const consolidateIngredients = (
		listItems: ListItem[],
		newItems: ListItem[],
		removingRecipe?: RecipeModel
	): ListItem[] => {
		return [...listItems, ...(newItems || [])]
			.reduce((acc: ListItem[], currentItem) => {
				const existingItem = acc.find(
					(item) =>
						item.listItem === currentItem.listItem &&
						item.unit.replace(/s$/, "") ===
							currentItem.unit.replace(/s$/, "")
				)

				if (existingItem) {
					if (removingRecipe) {
						// If removing a recipe, subtract ingredient quantity
						const recipeIngredient =
							removingRecipe.ingredients.dish.find(
								(ing) => ing.name === currentItem.listItem
							)
						existingItem.quantity = Math.max(
							0,
							existingItem.quantity -
								(recipeIngredient?.quantity || 0)
						)
					} else {
						// If adding a recipe, add ingredient quantity
						existingItem.quantity += currentItem.quantity
					}
				} else {
					acc.push(currentItem)
				}
				return acc
			}, [] as ListItem[])
			.filter((item) => item.quantity > 0) // Remove items with zero quantity
	} */
  /* 	const handleAdd = (e: React.FormEvent) => {
		e.preventDefault()
		if (newItem.listItem.trim() !== "") {
			setListItems((prevItems) =>
				consolidateIngredients(prevItems, [newItem])
			)
			setNewItem({
				id: Date.now(),
				quantity: 0,
				unit: "",
				listItem: "",
				isDone: false,
				toTransfer: false,
			})
		}
	} */
  useEffect(() => {
    if (loading || recipes.length === 0) return;

    const previous = previousSelectedRecipeIds.current;
    const newlySelectedIds = selectedRecipeIds.filter(
      (recipeId) => recipeId && !previous.includes(recipeId),
    );
    const deselectedIds = previous.filter(
      (recipeId) => recipeId && !selectedRecipeIds.includes(recipeId),
    );
    previousSelectedRecipeIds.current = [...selectedRecipeIds];

    const added = newlySelectedIds.flatMap((recipeId) => {
      const recipe = recipes.find((item) => item.id === recipeId);
      return recipe ? contributionsFor(recipe) : [];
    });
    if (added.length > 0) {
      setListItems((currentItems) => mergeIntoList(currentItems, added));
    }

    // Taking a recipe off the plan removes only what it added, and can be undone.
    for (const recipeId of deselectedIds) {
      const recipe = recipes.find((item) => item.id === recipeId);
      if (!recipe) continue;
      const contributions = contributionsFor(recipe);
      let snapshot: ListItem[] | null = null;
      undoable({
        message: `Removed ingredients for ${recipe.name}`,
        apply: () =>
          setListItems((current) => {
            snapshot = current;
            return removeRecipeFromList(current, recipeId, contributions);
          }),
        revert: () => {
          if (snapshot) setListItems(snapshot);
        },
      });
    }
  }, [selectedRecipeIds, recipes, loading, undoable]);

  return (
    <div className="grocerylist-container">
      <h1 className="grocerylist-title">myGroceryList</h1>
      {loading ? (
        <div className="loading">Loading grocery list...</div>
      ) : (
        <>
          <div className="grocery-list-toolbar">
            <button
              className="grocery-copy-btn"
              type="button"
              onClick={copyForGoogleKeep}
              disabled={!listItems.some((item) => !item.isDone)}
              title="Copy unchecked items for Google Keep"
            >
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="8" y="8" width="13" height="13" rx="2" />
                <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
              </svg>
              Copy for Google Keep
            </button>
            {canShare && (
              <button
                className="grocery-secondary-btn"
                type="button"
                onClick={shareGroceryList}
                disabled={!listItems.some((item) => !item.isDone)}
              >
                Share…
              </button>
            )}
            <a
              className="grocery-secondary-btn"
              href="https://keep.google.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Keep
            </a>
          </div>
          <div className="flex-container">
            <div className="edit-box">
              <EditableList listItems={listItems} setListItems={setListItems} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GroceryList;
