import React from "react";
import { useLocation, Link } from "react-router-dom";
import type { RecipeModel } from "../../types";
import RecipeDetails from "../Recipes/Recipe Details/RecipeDetails";

const RecipeDetailPage: React.FC = () => {
	const location = useLocation();
	const recipeFromState =
		(location.state as { recipe?: RecipeModel })?.recipe ?? null;

	return (
		<div style={{ padding: 16 }}>
			<div style={{ marginBottom: 12 }}>
				<Link to="/recipes">← Back to recipes</Link>
			</div>
			{/* Render RecipeDetails without passing showRecipe so it will use route state or fetch */}
			<RecipeDetails
				// Keep selection UI disabled when rendered as a dedicated page
				isSelected={false}
				showRecipe={recipeFromState}
				onSelectedRecipesChange={() => {}}
				showAddToSelectedRecipes={false}
			/>
		</div>
	);
};

export default RecipeDetailPage;
