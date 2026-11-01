import React, { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import useRecipe from "../../../hooks/useRecipe";
import { RecipeModel } from "../../../types";
import "../Recipes.css";
import "../../SousChef/SousChef.css";
import "./RecipeDetails.css";
import "../../Cook/Cook.css";
import apiClient from "../../pages/Client";
import { useToast } from "../../common/Toast";
import { useCookState } from "../../../hooks/useCookState";
import { useTimers } from "../../../hooks/useTimers";
import {
  displayIngredient,
  parseServings,
  toIngredientGroups,
} from "../../../utils/recipeIngredients";
import InstructionText from "../../Cook/InstructionText";
import ServingScaler from "../../Cook/ServingScaler";
import TimerTray from "../../Cook/TimerTray";

interface RecipeDetailsProps {
  isSelected: boolean;
  showRecipe?: RecipeModel | null;
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
  const { showToast } = useToast();
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isAddingToList, setIsAddingToList] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  // Router-aware: allow canonical /recipes/:id usage and support fast-path via Link state
  const params = useParams<{ id?: string }>();
  const location = useLocation();
  const routeStateRecipe = (location.state as { recipe?: RecipeModel })?.recipe;

  const { recipe: fetchedRecipe, loading: fetchingRecipe } = useRecipe(
    params?.id,
    routeStateRecipe,
  );

  const activeShowRecipe =
    showRecipe ?? routeStateRecipe ?? fetchedRecipe ?? null;

  const { state: cook, patch: patchCook } = useCookState(activeShowRecipe?.id);
  const timers = useTimers(activeShowRecipe?.id);
  const ingredientGroups = useMemo(
    () => toIngredientGroups(activeShowRecipe?.ingredients),
    [activeShowRecipe?.ingredients],
  );
  const baseServings = parseServings(activeShowRecipe?.serving_info?.servings);
  const hasSteps = (activeShowRecipe?.instructions?.length ?? 0) > 0;
  const resumable =
    cook.started && (cook.stepIndex > 0 || cook.checked.length > 0);

  const toggleChecked = (key: string) =>
    patchCook((prev) => ({
      checked: prev.checked.includes(key)
        ? prev.checked.filter((k) => k !== key)
        : [...prev.checked, key],
    }));

  // Initialize favorite state from recipe data
  useEffect(() => {
    if (activeShowRecipe) {
      setIsFavorite(activeShowRecipe.is_favorite || false);
    }
  }, [activeShowRecipe]);

  // Helper function to capitalize headings
  const capitalizeHeading = (str: string) => {
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Function to toggle selection and update parent component
  const handleCheckboxChange = () => {
    onSelectedRecipesChange(activeShowRecipe);
  };

  // Toggle favorite status
  const handleToggleFavorite = async () => {
    if (!activeShowRecipe) return;

    try {
      const response = await apiClient.patch<{ isFavorite: boolean }>(
        `/api/recipes/${activeShowRecipe.id}/favorite`,
      );
      const newFavoriteStatus = response.data.isFavorite;
      setIsFavorite(newFavoriteStatus);

      // Update the recipe object itself
      if (activeShowRecipe) {
        activeShowRecipe.is_favorite = newFavoriteStatus;
      }

      // Notify parent component if callback provided
      if (onFavoriteChange) {
        onFavoriteChange(activeShowRecipe.id, newFavoriteStatus);
      }
    } catch {
      console.error("Error toggling favorite");
      showToast("Failed to update favorite status", "error");
    }
  };

  // Add all ingredients to grocery list
  const handleAddToGroceryList = async () => {
    if (!activeShowRecipe) return;

    setIsAddingToList(true);
    try {
      const response = await apiClient.post<{
        success: boolean;
        itemsAdded: number;
        totalItems: number;
      }>(`/api/recipes/${activeShowRecipe.id}/add-to-grocery-list`, {
        scale: cook.scale,
      });

      if (response.data.success) {
        // Dispatch custom event to notify GroceryList component
        window.dispatchEvent(new CustomEvent("groceryListUpdated"));

        showToast(
          `Added ${response.data.itemsAdded} ingredients to your grocery list! Total items: ${response.data.totalItems}`,
          "success",
        );
      } else {
        showToast("Failed to add ingredients to grocery list", "error");
      }
    } catch (err: unknown) {
      console.error("Error adding ingredients to grocery list");

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

      showToast(errorMsg, "error");
    } finally {
      setIsAddingToList(false);
    }
  };

  // Generate (or reuse) a share link for this recipe and copy it to the clipboard
  const handleShareRecipe = async () => {
    if (!activeShowRecipe) return;

    setIsSharing(true);
    try {
      const response = await apiClient.post<{
        shareToken: string;
        shareUrl: string;
      }>(`/api/recipes/${activeShowRecipe.id}/share`);

      const shareUrl =
        response.data.shareUrl ||
        `${window.location.origin}/recipes/shared/${response.data.shareToken}`;

      await navigator.clipboard.writeText(shareUrl);
      showToast("Link copied!", "success");
    } catch (err: unknown) {
      console.error("Error sharing recipe");

      let errorMsg = "Failed to create share link";

      if (err instanceof Error) {
        errorMsg = err.message || errorMsg;
      } else if (typeof err === "object" && err !== null) {
        const e = err as {
          response?: { data?: { error?: string } };
          message?: string;
        };
        errorMsg = e?.response?.data?.error ?? e?.message ?? errorMsg;
      }

      showToast(errorMsg, "error");
    } finally {
      setIsSharing(false);
    }
  };

  // 1. Ingredients are normalized in toIngredientGroups so no line is ever dropped

  if (fetchingRecipe && !activeShowRecipe) {
    return (
      <div className="recipe-content">
        <div className="recipes-container">Loading recipe...</div>
      </div>
    );
  }

  return (
    <div className="recipe-content">
      {(activeShowRecipe || fetchingRecipe) && ingredientGroups && (
        <div className="recipes-container">
          <h2>{capitalizeHeading(activeShowRecipe?.name || "")}</h2>

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

            <button
              className="recipe-action-btn share-btn"
              onClick={handleShareRecipe}
              disabled={isSharing}
              title="Copy a shareable link to this recipe"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              {isSharing ? "Sharing..." : "Share"}
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
          {hasSteps && (
            <div className="recipe-actions-row">
              <Link
                className="start-cooking"
                to={`/recipes/${activeShowRecipe?.id}/cook`}
              >
                {resumable ? "Resume cooking" : "Start cooking"}
              </Link>
            </div>
          )}
          <div className="recipe-info">
            <p>
              <strong>{capitalizeHeading("Cuisine")}:</strong>{" "}
              {activeShowRecipe?.cuisine}
            </p>
            <p>
              <strong>{capitalizeHeading("Meal Type")}:</strong>{" "}
              {capitalizeHeading(activeShowRecipe?.meal_type || "")}
            </p>
          </div>

          {/* 3. Display Ingredients by Subheading (with capitalized headings) */}
          <section id="ingredients">
            <h2>{capitalizeHeading("Ingredients")}</h2>
            <ServingScaler
              baseServings={baseServings}
              scale={cook.scale}
              onChange={(scale) => patchCook({ scale })}
            />
            {ingredientGroups.map((group) => (
              <div className="eachIngredientSet" key={group.name}>
                {(ingredientGroups.length > 1 || group.name !== "default") && (
                  <h3 className="eachIngredientSetTitle">
                    {capitalizeHeading(group.name)}
                  </h3>
                )}
                <ul style={{ listStyle: "none", paddingLeft: 0 }}>
                  {group.items.map((entry) => {
                    const checked = cook.checked.includes(entry.key);
                    return (
                      <li key={entry.key}>
                        <label
                          className={`ingredient-check ${checked ? "checked" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleChecked(entry.key)}
                          />
                          <span>{displayIngredient(entry, cook.scale)}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {cook.checked.length > 0 && (
              <button
                type="button"
                className="cook-reset"
                onClick={() => patchCook({ checked: [] })}
              >
                Reset checks
              </button>
            )}
          </section>

          {/* 4. Display Instructions (with capitalized heading) */}
          <section id="instructions">
            <h2>{capitalizeHeading("Instructions")}</h2>
            <TimerTray
              timers={timers.timers}
              now={timers.now}
              onPause={timers.pause}
              onResume={timers.resume}
              onAddMinute={timers.addMinute}
              onDismiss={timers.dismiss}
            />
            <ol className="instructionSet">
              {activeShowRecipe?.instructions?.map((instruction) => (
                <li className="singleInstructions" key={instruction.number}>
                  <InstructionText
                    text={instruction.text}
                    stepLabel={`Step ${instruction.number}`}
                    onStartTimer={timers.start}
                  />
                </li>
              ))}
            </ol>
          </section>

          {/* 5. Display Notes if available */}
          {activeShowRecipe?.notes && activeShowRecipe.notes.length > 0 && (
            <section id="notes">
              <h2>{capitalizeHeading("Notes")}</h2>
              <ul>
                {activeShowRecipe?.notes?.map((note, index) => (
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
