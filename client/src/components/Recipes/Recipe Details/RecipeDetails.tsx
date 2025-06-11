/* eslint-disable no-mixed-spaces-and-tabs */
import React from "react"
import { RecipeModel } from "../../Models/Models"
import "../Recipes.css"
import "../../SousChef/SousChef.css"

// Interface for ingredient groups
interface IngredientGroup {
	name: string
	ingredients: {
		[subcategory: string]: {
			id: number
			quantity: number
			name: string
			unit?: string
		}[]
	} // Assuming consistent ingredient structure
}

interface RecipeDetailsProps {
	isSelected: boolean
	showRecipe: RecipeModel | null
	onSelectedRecipesChange: (recipe: RecipeModel | null) => void
	showAddToSelectedRecipes: boolean | null
}

const RecipeDetails: React.FC<RecipeDetailsProps> = ({
	showRecipe,
	onSelectedRecipesChange,
	isSelected,
	showAddToSelectedRecipes,
}) => {
	// Helper function to capitalize headings
	const capitalizeHeading = (str: string) => {
		return str
			.split(" ")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ")
	}

	// Function to toggle selection and update parent component
	const handleCheckboxChange = () => {
		onSelectedRecipesChange(showRecipe)
	}

	// 1. Organize Ingredients by Subheading (including "Selected Recipes" if checked)
	const ingredientGroups: IngredientGroup[] | null = showRecipe
		? Object.entries(showRecipe.ingredients).map(([name, ingredients]) => {
				// Handle all ingredient categories consistently (including "dish")
				if (Array.isArray(ingredients)) {
					return {
						name,
						// Ensure the ingredient objects match the IngredientGroup interface
						ingredients: {
							[name]: ingredients,
						},
					}
				} else {
					return {
						name: "No Ingredients",
						ingredients: {},
					}
				}
		  })
		: null
	/* 	if (isSelected && ingredientGroups) {
		ingredientGroups.unshift({
			// Add "Selected Recipes" group to the beginning
			name: "Selected",
			ingredients: { dish: showRecipe!.ingredients.dish },
		})
	}
 */
	return (
		<div className="recipes-container">
			{showRecipe && ingredientGroups && (
				<>
					<h2>{capitalizeHeading(showRecipe.name)}</h2>

					{/* Checkbox for selecting recipe */}
					{showAddToSelectedRecipes && (
						<div>
							<input
								type="checkbox"
								checked={isSelected}
								onChange={handleCheckboxChange}
							/>
							<label>Add to Selected Recipes</label>
						</div>
					)}

					{/* 2. Display Other Details (with capitalized headings) */}
					<div className="recipe-info">
						<p>
							<strong>{capitalizeHeading("Cuisine")}:</strong>{" "}
							{showRecipe.cuisine}
						</p>
						{/* </div>
					<div> */}
						<p>
							<strong>{capitalizeHeading("Meal Type")}:</strong>{" "}
							{capitalizeHeading(showRecipe["meal type"])}
						</p>
					</div>

					{/* 3. Display Ingredients by Subheading (with capitalized headings) */}
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
															ingredient.name &&
															ingredient.quantity
													)
													.map((ingredient) => (
														<li key={ingredient.id}>
															{`${
																ingredient.quantity
															} ${
																ingredient.unit
																	? ingredient.unit
																	: ""
															} ${
																ingredient.name
															}`}
														</li>
													))
											: []
								)}
							</ul>
						</div>
					))}

					{/* 4. Display Instructions (with capitalized heading) */}
					<h2>{capitalizeHeading("Instructions")}</h2>
					<ol className="instructionSet">
						{showRecipe.instructions.map((instruction) => (
							<li
								className="singleInstructions"
								key={instruction.number}
							>
								{instruction.text}
							</li>
						))}
					</ol>
				</>
			)}
		</div>
	)
}

export default RecipeDetails
