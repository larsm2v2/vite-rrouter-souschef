import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import RecipesIndex from "../Recipes/RecipesIndex";
import RecipeDisplay from "../RecipeDisplay/RecipeDisplay";
import { RecipeModel } from "../../types";

function RecipesPage() {
	const {
		selectedRecipeIds,
		setSelectedRecipeIds,
		recipeToDisplay,
		setRecipeToDisplay,
		setRecipes,
	} = useOutletContext<{
		selectedRecipeIds: string[];
		setSelectedRecipeIds: React.Dispatch<React.SetStateAction<string[]>>;
		recipeToDisplay: RecipeModel | null;
		setRecipeToDisplay: React.Dispatch<
			React.SetStateAction<RecipeModel | null>
		>;
		recipes: RecipeModel[];
		setRecipes: React.Dispatch<React.SetStateAction<RecipeModel[]>>;
		searchQuery?: string;
		setSearchQuery?: React.Dispatch<React.SetStateAction<string>>;
	}>();

	const [isLoading, setIsLoading] = useState(false);
	const [savedRecipe, setSavedRecipe] = useState<boolean>(false);
	const [showAddToSelectedRecipes, setShowAddToSelectedRecipes] =
		useState<boolean>(false);
	const [generatedRecipe, setGeneratedRecipe] = useState<RecipeModel | null>(
		null
	);
	const [, setSelectedRecipe] = useState<RecipeModel | null>(null);
	const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(
		null
	);
	const [, setWillTryAgain] = useState(false);

	return (
		<>
			<RecipeDisplay
				savedRecipe={savedRecipe}
				setSavedRecipe={setSavedRecipe}
				setWillTryAgain={setWillTryAgain}
				isLoading={isLoading}
				setIsLoading={setIsLoading}
				activeContent="recipes"
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
			<RecipesIndex
				setSelectedRecipeId={setSelectedRecipeId}
				selectedRecipeIds={selectedRecipeIds}
				setSelectedRecipeIds={setSelectedRecipeIds}
				isLoading={isLoading}
				setIsLoading={setIsLoading}
				setRecipes={setRecipes}
			/>
		</>
	);
}

export default RecipesPage;
