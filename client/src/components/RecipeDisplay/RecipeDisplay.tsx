import React, { useState, useEffect } from "react";
import { RecipeModel } from "../Models/Models";
import RecipeDetails from "../Recipes/Recipe Details/RecipeDetails"; // Import your RecipeDetails component
import "../Recipes/Recipes.css"; // Import your CSS for styling
import Chef from "../../assets/Chef"; // Import your Chef SVG component
import apiClient from "../pages/Client";

interface RecipeDisplayProps {
  setWillTryAgain: (willTryAgain: boolean) => void;
  savedRecipe: boolean;
  setSavedRecipe: (savedRecipe: boolean) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  activeContent: "recipes" | "sousChef";
  setActiveContent: (content: "recipes" | "sousChef") => void;
  selectedRecipeId?: string | null;
  setSelectedRecipeId: (id: string | null) => void;
  selectedRecipeIds: string[];
  setSelectedRecipeIds: React.Dispatch<React.SetStateAction<string[]>>;
  generatedRecipe?: RecipeModel | null;
  setGeneratedRecipe: (recipe: RecipeModel | null) => void;
  setSelectedRecipe: (recipe: RecipeModel | null) => void;
  recipeToDisplay: RecipeModel | null;
  setRecipeToDisplay: (recipe: RecipeModel | null) => void;
  showAddToSelectedRecipes: boolean | null;
  setShowAddToSelectedRecipes: (showAddToSelectedRecipes: boolean) => void;
}

const RecipeDisplay: React.FC<RecipeDisplayProps> = ({
  setWillTryAgain,
  savedRecipe,
  setSavedRecipe,
  isLoading,
  setIsLoading,
  activeContent,
  setActiveContent,
  selectedRecipeId,
  selectedRecipeIds,
  setSelectedRecipeIds,
  generatedRecipe,
  setGeneratedRecipe,
  setSelectedRecipe,
  recipeToDisplay,
  setRecipeToDisplay,
  setShowAddToSelectedRecipes,
}) => {
  /* const [recipe, setRecipe] = useState<RecipeModel | null>(null)
	const [showRecipe, setShowRecipe] = useState<RecipeModel | null>(null) */
  const [recipes, setRecipes] = useState<RecipeModel[]>([]);
  const [, setFetchingRecipe] = useState<boolean>(false);

  /* 	const handleRecipeClick = () => {
		setSelectedRecipe(recipe)
		console.log(selectedRecipe)
		console.log("Received generatedRecipe:", generatedRecipe)
	} */

  const fetchRecipes = async () => {
    try {
      const response = await apiClient.get<RecipeModel[]>(`/api/recipes`);

      if (response.status === 200) {
        setRecipes(response.data);
      } else {
        throw new Error("Failed to fetch recipes.");
      }
    } catch (error) {
      console.error("Error fetching recipes:", error);
    }
  };

  useEffect(() => {
    fetchRecipes(); // Fetch recipes only once when component mounts
  }, []);

  useEffect(() => {
    if (activeContent === "sousChef" && generatedRecipe) {
      // If in SousChef mode and there's a generated recipe, show it
      setRecipeToDisplay(generatedRecipe);
      setShowAddToSelectedRecipes(false); // Hide "Add to Selected Recipes" button in SousChef mode
    } else if (selectedRecipeId) {
      // If a recipeId is selected, find it in the fetched recipes
      const recipe = recipes.find(
        (r: RecipeModel) => r.id === selectedRecipeId
      );
      if (recipe) {
        setRecipeToDisplay(recipe);
      } else {
        // If the recipe isn't found locally, you might want to fetch it from the server here
        // For now, we'll just handle it as undefined
        setRecipeToDisplay(null);
      }
      setFetchingRecipe(false);
    } else {
      setRecipeToDisplay(null); // If no recipe is selected or being generated, don't show anything
      setShowAddToSelectedRecipes(false);
    }
  }, [
    selectedRecipeId,
    recipes,
    generatedRecipe,
    activeContent,
    setIsLoading,
    setRecipeToDisplay,
    setShowAddToSelectedRecipes,
  ]); // Add dependencies
  // Function to save the recipe
  const handleSaveRecipe = async () => {
    setSavedRecipe(false);
    try {
      const response = await fetch(`/api/clean-and-add-recipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(generatedRecipe),
      });
      if (response.ok) {
        // ... (add logic to update your state or show a success message)
        console.log("Recipe saved successfully!");
        setSavedRecipe(true);
      } else {
        console.error("Error saving recipe:", response.statusText);
      }
    } catch (error) {
      console.error("Error saving recipe:", error);
    }
  };
  const handleSelectedRecipesChange = (recipe: RecipeModel | null) => {
    setSelectedRecipeIds((prevSelectedIds: string[]) => {
      if (recipe) {
        if (prevSelectedIds.includes(recipe.id)) {
          return prevSelectedIds.filter((id: string) => id !== recipe.id);
        } else {
          return [...prevSelectedIds, recipe.id];
        }
      } else {
        return prevSelectedIds;
      }
    });
  };

  // Handle favorite changes - update the recipes array
  const handleFavoriteChange = (recipeId: string, isFavorite: boolean) => {
    setRecipes((prevRecipes) =>
      prevRecipes.map((r) =>
        r.id === recipeId ? { ...r, is_favorite: isFavorite } : r
      )
    );
  };

  useEffect(() => {
    if (selectedRecipeId) {
      const recipe = recipes.find(
        (r: RecipeModel) => r.id === selectedRecipeId
      );
      if (recipe) {
        setSelectedRecipe(recipe); // Use the recipeToDisplay state to store and display the selected recipe
      } else {
        // Handle the case where the recipe isn't found locally (e.g., fetch from server)
      }
    } else {
      setSelectedRecipe(null); // Clear the displayed recipe when no recipe is selected
    }
  }, [setSelectedRecipe, selectedRecipeId, recipes]); // Add recipes as a dependency

  const tryAgainToTrue = () => {
    setWillTryAgain(true);
    setIsLoading(true);
    setSavedRecipe(false);
    setGeneratedRecipe(null); // Clear generated recipe when trying again
    setActiveContent("sousChef");
  };

  return (
    <div className="recipes-container">
      {recipeToDisplay && !isLoading ? (
        <div className="recipes-container">
          <RecipeDetails
            showRecipe={recipeToDisplay}
            onSelectedRecipesChange={handleSelectedRecipesChange}
            isSelected={selectedRecipeIds.includes(selectedRecipeId || "")}
            showAddToSelectedRecipes={activeContent === "recipes"}
            onFavoriteChange={handleFavoriteChange}
          />

          {activeContent === "sousChef" && (
            <div>
              <button className="surprise" onClick={tryAgainToTrue}>
                {isLoading ? `Processing...` : `Try Again`}
              </button>
              <button className="surprise" onClick={handleSaveRecipe}>
                {savedRecipe ? `Saved` : `Save Recipe`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="chefContainer">
          <Chef isLoading={isLoading} size={500} />
        </div>
      )}
    </div>
  );
};

export default RecipeDisplay;
