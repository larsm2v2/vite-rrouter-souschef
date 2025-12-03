import React, { useState, useEffect } from "react";
import { RecipeModel } from "../../Models/Models";
import "../Recipes.css";
import "../../SousChef/SousChef.css";
import "./RecipeDetails.css";
import apiClient from "../../pages/Client";

// Interface for ingredient groups
interface IngredientGroup {
  name: string;
  ingredients: {
    [subcategory: string]: {
      id: number;
      quantity: number;
      name: string;
      unit?: string;
    }[];
  }; // Assuming consistent ingredient structure
}

interface RecipeDetailsProps {
  isSelected: boolean;
  showRecipe: RecipeModel | null;
  onSelectedRecipesChange: (recipe: RecipeModel | null) => void;
  showAddToSelectedRecipes: boolean | null;
  onFavoriteChange?: (recipeId: string, isFavorite: boolean) => void;
}

const RecipeDetails: React.FC<RecipeDetailsProps> = ({
  showRecipe,
  onSelectedRecipesChange,
  isSelected,
  showAddToSelectedRecipes,
  onFavoriteChange,
}) => {
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isAddingToList, setIsAddingToList] = useState<boolean>(false);

  // Initialize favorite state from recipe data
  useEffect(() => {
    if (showRecipe) {
      setIsFavorite(showRecipe.is_favorite || false);
    }
  }, [showRecipe]);

  // Helper function to capitalize headings
  const capitalizeHeading = (str: string) => {
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Function to toggle selection and update parent component
  const handleCheckboxChange = () => {
    onSelectedRecipesChange(showRecipe);
  };

  // Toggle favorite status
  const handleToggleFavorite = async () => {
    if (!showRecipe) return;

    try {
      const response = await apiClient.patch<{ isFavorite: boolean }>(
        `/api/recipes/${showRecipe.id}/favorite`
      );
      const newFavoriteStatus = response.data.isFavorite;
      setIsFavorite(newFavoriteStatus);

      // Update the recipe object itself
      if (showRecipe) {
        showRecipe.is_favorite = newFavoriteStatus;
      }

      // Notify parent component if callback provided
      if (onFavoriteChange) {
        onFavoriteChange(showRecipe.id, newFavoriteStatus);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      alert("Failed to update favorite status");
    }
  };

  // Add all ingredients to grocery list
  const handleAddToGroceryList = async () => {
    if (!showRecipe) return;

    setIsAddingToList(true);
    try {
      const response = await apiClient.post<{
        success: boolean;
        itemsAdded: number;
        totalItems: number;
      }>(`/api/recipes/${showRecipe.id}/add-to-grocery-list`);

      if (response.data.success) {
        // Dispatch custom event to notify GroceryList component
        window.dispatchEvent(new CustomEvent("groceryListUpdated"));

        alert(
          `Added ${response.data.itemsAdded} ingredients to your grocery list! Total items: ${response.data.totalItems}`
        );
      } else {
        alert("Failed to add ingredients to grocery list");
      }
    } catch (err: unknown) {
      console.error("Error adding to grocery list:", err);

      let errorMsg = "Failed to add ingredients to grocery list";

      if (err instanceof Error) {
        errorMsg = err.message || errorMsg;
      } else if (typeof err === "object" && err !== null) {
        const e = err as {
          response?: { data?: { error?: string } };
          message?: string;
        };
        errorMsg = e?.response?.data?.error ?? e?.message ?? errorMsg;
      }

      alert(errorMsg);
    } finally {
      setIsAddingToList(false);
    }
  };

  // 1. Organize Ingredients by Subheading - use backend structure directly
  const ingredientGroups: IngredientGroup[] | null = showRecipe
    ? Object.entries(showRecipe.ingredients)
        .map(([name, ingredients]) => {
          if (Array.isArray(ingredients) && ingredients.length > 0) {
            return {
              name,
              ingredients: {
                [name]: ingredients,
              },
            };
          }
          return null;
        })
        .filter((group): group is IngredientGroup => group !== null)
    : null;

  return (
    <div className="recipe-content">
      {showRecipe && ingredientGroups && (
        <div className="recipes-container">
          <h2>{capitalizeHeading(showRecipe.name)}</h2>

          {/* Action buttons row */}
          <div className="recipe-actions-row">
            <button
              className={`recipe-action-btn favorite-btn ${
                isFavorite ? "active" : ""
              }`}
              onClick={handleToggleFavorite}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={isFavorite ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {isFavorite ? "Favorited" : "Favorite"}
            </button>

            <button
              className="recipe-action-btn add-to-list-btn"
              onClick={handleAddToGroceryList}
              disabled={isAddingToList}
              title="Add all ingredients to grocery list"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              {isAddingToList ? "Adding..." : "Add to Grocery List"}
            </button>

            {/* Add to Selected Recipes toggle */}
            {showAddToSelectedRecipes && (
              <button
                className={`recipe-action-btn selected-recipe-btn ${
                  isSelected ? "active" : ""
                }`}
                onClick={handleCheckboxChange}
                title={
                  isSelected
                    ? "Remove from selected recipes"
                    : "Add to selected recipes"
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  {isSelected && <path d="M9 12l2 2 4-4" />}
                </svg>
                {isSelected ? "Selected" : "Add to Selected Recipes"}
              </button>
            )}
          </div>

          {/* 2. Display Other Details (with capitalized headings) */}
          <div className="recipe-info">
            <p>
              <strong>{capitalizeHeading("Cuisine")}:</strong>{" "}
              {showRecipe.cuisine}
            </p>
            <p>
              <strong>{capitalizeHeading("Meal Type")}:</strong>{" "}
              {capitalizeHeading(showRecipe.meal_type)}
            </p>
          </div>

          {/* 3. Display Ingredients by Subheading (with capitalized headings) */}
          <section id="ingredients">
            <h2>{capitalizeHeading("Ingredients")}</h2>
            {ingredientGroups?.map((group) => (
              <div className="eachIngredientSet" key={group.name}>
                <h3 className="eachIngredientSetTitle">
                  {capitalizeHeading(group.name)}
                </h3>
                <ul>
                  {/* Access the ingredients array for the specific group */}
                  {Object.values(group.ingredients).flatMap(
                    (ingredientsArray) =>
                      Array.isArray(ingredientsArray) // Check if ingredientsArray is an array
                        ? ingredientsArray
                            .filter(
                              (ingredient) =>
                                ingredient.name && ingredient.quantity
                            )
                            .map((ingredient) => (
                              <li key={ingredient.id}>
                                {`${ingredient.quantity} ${
                                  ingredient.unit ? ingredient.unit : ""
                                } ${ingredient.name}`}
                              </li>
                            ))
                        : []
                  )}
                </ul>
              </div>
            ))}
          </section>

          {/* 4. Display Instructions (with capitalized heading) */}
          <section id="instructions">
            <h2>{capitalizeHeading("Instructions")}</h2>
            <ol className="instructionSet">
              {showRecipe.instructions.map((instruction) => (
                <li className="singleInstructions" key={instruction.number}>
                  {instruction.text}
                </li>
              ))}
            </ol>
          </section>

          {/* 5. Display Notes if available */}
          {showRecipe.notes && showRecipe.notes.length > 0 && (
            <section id="notes">
              <h2>{capitalizeHeading("Notes")}</h2>
              <ul>
                {showRecipe.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default RecipeDetails;
