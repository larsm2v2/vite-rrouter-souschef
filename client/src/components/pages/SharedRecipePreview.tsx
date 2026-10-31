import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import apiClient from "./Client";
import { useToast } from "../common/Toast";
import type { RecipeModel } from "../../types";
import "../Recipes/Recipes.css";
import "../Recipes/Recipe Details/RecipeDetails.css";
import "./SharedRecipePreview.css";

// Interface for ingredient groups (mirrors RecipeDetails.tsx)
interface IngredientGroup {
  name: string;
  ingredients: {
    [subcategory: string]: {
      id: number;
      quantity: number;
      name: string;
      unit?: string;
    }[];
  };
}

const SharedRecipePreview: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [recipe, setRecipe] = useState<RecipeModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    let isActive = true;

    const fetchSharedRecipe = async () => {
      if (!token) {
        setError("Invalid share link");
        setLoading(false);
        return;
      }

      try {
        const response = await apiClient.get<RecipeModel>(
          `/api/recipes/shared/${token}`,
        );
        if (isActive) {
          setRecipe(response.data);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isActive) return;
        const e = err as {
          response?: { status?: number; data?: { error?: string } };
          message?: string;
        };
        setError(
          e?.response?.status === 404
            ? "This shared recipe link is invalid or has expired."
            : (e?.response?.data?.error ?? "Failed to load shared recipe."),
        );
        setLoading(false);
      }
    };

    fetchSharedRecipe();

    return () => {
      isActive = false;
    };
  }, [token]);

  const capitalizeHeading = (str: string) => {
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleAcceptShare = async () => {
    if (!token) return;

    setIsAccepting(true);
    try {
      const response = await apiClient.post<{ recipeId: number }>(
        `/api/recipes/shared/${token}/accept`,
      );
      showToast("Recipe added to your recipes!", "success");
      navigate(`/recipes/${response.data.recipeId}`);
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      showToast(e?.response?.data?.error ?? "Failed to add recipe.", "error");
    } finally {
      setIsAccepting(false);
    }
  };

  const ingredientGroups: IngredientGroup[] | null = recipe
    ? Object.entries(recipe.ingredients)
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

  if (loading) {
    return (
      <div className="recipe-content">
        <div className="recipes-container">Loading shared recipe...</div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="recipe-content">
        <div className="recipes-container">
          <p className="shared-recipe-error">
            {error || "Shared recipe not found."}
          </p>
          <Link to="/recipes">← Back to my recipes</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="recipe-content">
      <div className="recipes-container">
        <div className="shared-recipe-banner">
          You're viewing a shared recipe (read-only)
        </div>

        <h2>{capitalizeHeading(recipe.name || "")}</h2>

        <div className="recipe-actions-row">
          <button
            className="recipe-action-btn accept-share-btn"
            onClick={handleAcceptShare}
            disabled={isAccepting}
            title="Copy this recipe into your own recipes"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {isAccepting ? "Adding..." : "Add to My Recipes"}
          </button>
        </div>

        <div className="recipe-info">
          <p>
            <strong>{capitalizeHeading("Cuisine")}:</strong> {recipe.cuisine}
          </p>
          <p>
            <strong>{capitalizeHeading("Meal Type")}:</strong>{" "}
            {capitalizeHeading(recipe.meal_type || "")}
          </p>
        </div>

        <section id="ingredients">
          <h2>{capitalizeHeading("Ingredients")}</h2>
          {ingredientGroups?.map((group) => (
            <div className="eachIngredientSet" key={group.name}>
              <h3 className="eachIngredientSetTitle">
                {capitalizeHeading(group.name)}
              </h3>
              <ul>
                {Object.values(group.ingredients).flatMap((ingredientsArray) =>
                  Array.isArray(ingredientsArray)
                    ? ingredientsArray
                        .filter(
                          (ingredient) =>
                            ingredient.name && ingredient.quantity,
                        )
                        .map((ingredient) => (
                          <li key={ingredient.id}>
                            {`${ingredient.quantity} ${
                              ingredient.unit ? ingredient.unit : ""
                            } ${ingredient.name}`}
                          </li>
                        ))
                    : [],
                )}
              </ul>
            </div>
          ))}
        </section>

        <section id="instructions">
          <h2>{capitalizeHeading("Instructions")}</h2>
          <ol className="instructionSet">
            {recipe.instructions?.map((instruction) => (
              <li className="singleInstructions" key={instruction.number}>
                {instruction.text}
              </li>
            ))}
          </ol>
        </section>

        {recipe.notes && recipe.notes.length > 0 && (
          <section id="notes">
            <h2>{capitalizeHeading("Notes")}</h2>
            <ul>
              {recipe.notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};

export default SharedRecipePreview;
