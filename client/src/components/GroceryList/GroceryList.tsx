import React, { useState, useEffect, useCallback, useRef } from "react";
import "./GroceryList.css";
import { RecipeModel } from "../../types";
import EditableList from "./EditableList/EditableList";
import { ListItem } from "../../types";
import apiClient from "../pages/Client";
import { useToast } from "../common/Toast";

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
  const previousSelectedRecipeIds = useRef([...selectedRecipeIds]);
  const [recipes, setRecipes] = useState<RecipeModel[]>([]);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<number | null>(null);

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
        }[];
        createdAt: string;
        isCurrent: boolean;
      }>("/api/grocery-list/version");

      if (response.status === 200 && response.data?.listData) {
        // Convert backend format to ListItem format
        const backendItems: ListItem[] = response.data.listData.map(
          (
            item: {
              quantity?: number;
              unit?: string;
              name?: string;
              checked?: boolean;
            },
            index: number,
          ) => ({
            id: index,
            quantity: item.quantity || 0,
            unit: item.unit || "",
            listItem: item.name || "",
            isDone: item.checked || false,
            toTransfer: false,
          }),
        );
        setListItems(backendItems);
      }
    } catch {
      console.error("Error fetching grocery list");
      // Initialize with empty list if fetch fails
      setListItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const copyForGoogleKeep = async () => {
    const uncheckedItems = listItems.filter((item) => !item.isDone);
    if (uncheckedItems.length === 0) {
      showToast("No unchecked items to copy", "info");
      return;
    }

    const text = uncheckedItems
      .map((item) =>
        `${item.quantity || ""} ${item.unit || ""} ${item.listItem}`
          .replace(/\s+/g, " ")
          .trim(),
      )
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${uncheckedItems.length} items!`, "success");
    } catch {
      console.error("Failed to copy grocery list");
      showToast("Could not access the clipboard", "error");
    }
  };

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
      try {
        // Prepare payload in backend expected format
        const payload = {
          listData: listItems.map((item) => ({
            name: item.listItem,
            quantity: item.quantity,
            unit: item.unit,
            checked: item.isDone,
          })),
        };

        // Create a new shopping list version marked current on the server
        // Endpoint: POST /api/grocery-list/version
        const resp = await apiClient.post("/api/grocery-list/version", payload);
        if (resp.status >= 200 && resp.status < 300) {
          // Notify other components to refresh if needed
          window.dispatchEvent(new Event("groceryListUpdated"));
        }
      } catch {
        console.error("Failed to persist grocery list changes");
      }
    }, 500); // 500ms debounce
    saveTimerRef.current = timerId;

    // Cleanup if list changes again quickly
    return () => {
      window.clearTimeout(timerId);
    };
  }, [listItems, loading]);

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
        // Add each already stocked item to listItems
        const newItems = stockedItems.map(
          (item: { name: string; quantity: number; unit: string }) => ({
            id: Date.now() + Math.random(),
            quantity: item.quantity,
            unit: item.unit,
            listItem: item.name,
            isDone: false,
            toTransfer: false,
          }),
        );

        // Merge with existing list items
        setListItems((prevItems) => {
          const merged = [...prevItems];
          newItems.forEach((newItem) => {
            const existingIndex = merged.findIndex(
              (item) =>
                item.listItem.toLowerCase() === newItem.listItem.toLowerCase(),
            );
            if (existingIndex >= 0) {
              if (merged[existingIndex].unit === newItem.unit) {
                merged[existingIndex].quantity += newItem.quantity;
              } else {
                merged.push(newItem);
              }
            } else {
              merged.push(newItem);
            }
          });
          return merged;
        });
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

    const newlySelectedIds = selectedRecipeIds.filter(
      (recipeId) =>
        recipeId && !previousSelectedRecipeIds.current.includes(recipeId),
    );
    previousSelectedRecipeIds.current = [...selectedRecipeIds];
    if (newlySelectedIds.length === 0) return;

    const newIngredients: ListItem[] = [];
    newlySelectedIds.forEach((recipeId) => {
      const recipe = recipes.find((item) => item.id === recipeId);
      if (!recipe) return;

      Object.values(recipe.ingredients)
        .flat()
        .forEach((ingredient) => {
          newIngredients.push({
            id: Date.now() + Math.random(),
            quantity: ingredient.quantity || 0,
            unit: ingredient.unit || "",
            listItem: ingredient.name,
            isDone: false,
            toTransfer: false,
          });
        });
    });

    if (newIngredients.length === 0) return;

    setListItems((currentItems) => {
      const mergedList = [...currentItems];
      newIngredients.forEach((ingredient) => {
        const existingIndex = mergedList.findIndex(
          (item) =>
            item.listItem.toLowerCase() === ingredient.listItem.toLowerCase(),
        );

        if (existingIndex >= 0) {
          if (mergedList[existingIndex].unit === ingredient.unit) {
            mergedList[existingIndex] = {
              ...mergedList[existingIndex],
              quantity:
                mergedList[existingIndex].quantity + ingredient.quantity,
            };
          } else {
            mergedList.push(ingredient);
          }
        } else {
          mergedList.push(ingredient);
        }
      });
      return mergedList;
    });
  }, [selectedRecipeIds, recipes, loading]);

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
