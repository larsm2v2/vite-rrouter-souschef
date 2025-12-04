import React, { useState, useEffect, useCallback, useRef } from "react";
import "./GroceryList.css";
import { RecipeModel } from "../Models/Models";
import EditableList from "./EditableList/EditableList";
import { ListItem } from "../Models/Models";
import apiClient from "../pages/Client";

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
  const [, setRecipeIngredients] = useState<{
    [recipeId: string]: ListItem[];
  }>({});
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
            index: number
          ) => ({
            id: index,
            quantity: item.quantity || 0,
            unit: item.unit || "",
            listItem: item.name || "",
            isDone: item.checked || false,
            toTransfer: false,
          })
        );
        setListItems(backendItems);
      }
    } catch (error) {
      console.error("Error fetching grocery list:", error);
      // Initialize with empty list if fetch fails
      setListItems([]);
    } finally {
      setLoading(false);
    }
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
      } catch (err) {
        console.error("Failed to persist grocery list changes:", err);
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
          })
        );

        // Merge with existing list items
        setListItems((prevItems) => {
          const merged = [...prevItems];
          newItems.forEach((newItem) => {
            const existingIndex = merged.findIndex(
              (item) =>
                item.listItem.toLowerCase() === newItem.listItem.toLowerCase()
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
      handleAddAlreadyStockedToGrocery
    );

    return () => {
      window.removeEventListener(
        "addAlreadyStockedToGrocery",
        handleAddAlreadyStockedToGrocery
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
      } catch (error) {
        console.error("Error fetching recipes:", error);
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
  // Intentional deps: we avoid including listItems to prevent feedback loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const updateGroceryList = async () => {
      if (loading) return; // Wait for initial grocery list to load

      const newRecipeIngredients: { [recipeId: string]: ListItem[] } = {};
      const validRecipeIds = selectedRecipeIds.filter(
        (recipeId) => recipeId !== null && recipeId !== ""
      );
      await Promise.all(
        validRecipeIds.map(async (recipeId) => {
          const recipe = recipes.find((r) => r.id === recipeId);
          if (recipe) {
            newRecipeIngredients[recipeId] = Object.values(recipe.ingredients)
              .flat()
              .map((ingredient) => {
                // Ingredient names are already stored in canonical form in the database
                return {
                  id: Date.now() + Math.random(), // Generate a unique ID
                  quantity: ingredient.quantity || 0,
                  unit: ingredient.unit || "",
                  listItem: ingredient.name,
                  isDone: false,
                  toTransfer: false,
                };
              });
          }
        })
      );

      setRecipeIngredients(newRecipeIngredients);
      const allIngredients = Object.values(newRecipeIngredients).flat();

      // Merge selected recipe ingredients with existing grocery list items
      const mergedList = [...listItems];

      allIngredients.forEach((ingredient) => {
        const existingIndex = mergedList.findIndex(
          (item) =>
            item.listItem.toLowerCase() === ingredient.listItem.toLowerCase()
        );

        if (existingIndex >= 0) {
          // If item exists and units match, add quantities
          if (mergedList[existingIndex].unit === ingredient.unit) {
            mergedList[existingIndex].quantity += ingredient.quantity;
          } else {
            // Different units, add as new item
            mergedList.push(ingredient);
          }
        } else {
          // New item, add to list
          mergedList.push(ingredient);
        }
      });

      setListItems(mergedList);
    };

    updateGroceryList();
  }, [selectedRecipeIds, recipes, loading]);

  return (
    <div className="grocerylist-container">
      <h1 className="grocerylist-title">myGroceryList</h1>
      {loading ? (
        <div className="loading">Loading grocery list...</div>
      ) : (
        <div className="flex-container">
          <div className="edit-box">
            <EditableList listItems={listItems} setListItems={setListItems} />
          </div>
        </div>
      )}
    </div>
  );
};

export default GroceryList;
