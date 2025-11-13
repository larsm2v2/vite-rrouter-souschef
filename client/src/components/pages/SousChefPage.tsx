import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import SousChef from "../SousChef/SousChef";
import RecipeGenerator from "../SousChef/RecipeGenerator";
import RecipeDisplay from "../RecipeDisplay/RecipeDisplay";
import { RecipeModel } from "../Models/Models";
import "../SousChef/SousChef.css";

function SousChefPage() {
  const {
    selectedRecipeIds,
    setSelectedRecipeIds,
    recipeToDisplay,
    setRecipeToDisplay,
  } = useOutletContext<{
    selectedRecipeIds: string[];
    setSelectedRecipeIds: React.Dispatch<React.SetStateAction<string[]>>;
    recipeToDisplay: RecipeModel | null;
    setRecipeToDisplay: React.Dispatch<
      React.SetStateAction<RecipeModel | null>
    >;
  }>();

  const [willTryAgain, setWillTryAgain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savedRecipe, setSavedRecipe] = useState<boolean>(false);
  const [showAddToSelectedRecipes, setShowAddToSelectedRecipes] =
    useState<boolean>(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<RecipeModel | null>(
    null
  );
  const [, setSelectedRecipe] = useState<RecipeModel | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const handleRecipeGenerated = (recipe: RecipeModel | null) => {
    setGeneratedRecipe(recipe);
    setIsLoading(false);
  };

  return (
    <div className="souschef-page">
      <RecipeGenerator />

      <RecipeDisplay
        savedRecipe={savedRecipe}
        setSavedRecipe={setSavedRecipe}
        setWillTryAgain={setWillTryAgain}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        activeContent="sousChef"
        setActiveContent={() => {}}
        selectedRecipeId={selectedRecipeId}
        setSelectedRecipeId={setSelectedRecipeId}
        selectedRecipeIds={selectedRecipeIds}
        setSelectedRecipeIds={setSelectedRecipeIds}
        generatedRecipe={generatedRecipe}
        setGeneratedRecipe={setGeneratedRecipe}
        setSelectedRecipe={setSelectedRecipe}
        recipeToDisplay={recipeToDisplay}
        setRecipeToDisplay={setRecipeToDisplay}
        showAddToSelectedRecipes={showAddToSelectedRecipes}
        setShowAddToSelectedRecipes={setShowAddToSelectedRecipes}
      />
      <SousChef
        willTryAgain={willTryAgain}
        setWillTryAgain={setWillTryAgain}
        onRecipeGenerated={handleRecipeGenerated}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
      />
    </div>
  );
}

export default SousChefPage;
