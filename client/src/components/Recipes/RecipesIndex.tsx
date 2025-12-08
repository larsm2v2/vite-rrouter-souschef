import React, { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Link } from "react-router-dom";
import "./Recipes.css";
import { RecipeModel } from "../../types";
import apiClient from "../pages/Client";

interface RecipesIndexProps {
	isLoading: boolean;
	setIsLoading: (loading: boolean) => void;
	selectedRecipeIds: string[];
	setSelectedRecipeIds: React.Dispatch<React.SetStateAction<string[]>>;
	setSelectedRecipeId: (recipeId: string | null) => void;
	setRecipes?: React.Dispatch<React.SetStateAction<RecipeModel[]>>;
}
/* 	selectedRecipe: RecipeModel | null
	setSelectedRecipe: React.Dispatch<React.SetStateAction<RecipeModel | null>> */

const RecipesIndex: React.FC<RecipesIndexProps> = ({
	selectedRecipeIds,
	setSelectedRecipeIds,
	setSelectedRecipeId,
	setRecipes: setRecipesInContext,
	/* 	selectedRecipe,
	setSelectedRecipe, */
}) => {
	const [recipes, setLocalRecipes] = React.useState<RecipeModel[]>([]);
	const { searchQuery = "", setSearchQuery = () => {} } = useOutletContext<{
		searchQuery?: string;
		setSearchQuery?: React.Dispatch<React.SetStateAction<string>>;
	}>();
	const [showSelected, setShowSelected] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const prevSelectedRecipeIds = useRef<string[]>(selectedRecipeIds);
	const mealTypeOrder = [
		"Breakfast",
		"Lunch",
		"Appetizer",
		"Dinner",
		"Dessert",
	];
	const fetchRecipes = async (
		setRecipes: React.Dispatch<React.SetStateAction<RecipeModel[]>>
	) => {
		try {
			const response = await apiClient.get<RecipeModel[]>(`/api/recipes`);
			if (response.status === 200) {
				setRecipes(response.data); // Server returns recipes directly from database
				setRecipesInContext?.(response.data); // Also update context if provided
				console.log("JSON retrieved: ", response.data);
			} else {
				throw new Error("Failed to fetch recipes.");
			}
		} catch (error) {
			console.error("Error fetching recipes:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		// Fetch recipes when the component mounts
		fetchRecipes(setLocalRecipes); // Call the function here
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	// Filtering based on search and showSelected
	// Group recipes by meal type
	const recipesByMealType = recipes.reduce((acc, recipe) => {
		// Safety check for meal type
		const mealTypeRaw = recipe.meal_type || "Other";
		const mealType =
			mealTypeRaw.charAt(0).toUpperCase() + mealTypeRaw.slice(1); // Capitalize
		if (!acc[mealType]) {
			acc[mealType] = [];
		}
		acc[mealType].push(recipe);
		return acc;
	}, {} as { [mealType: string]: RecipeModel[] });

	// Sort recipes within each meal type alphabetically
	for (const mealType in recipesByMealType) {
		recipesByMealType[mealType].sort((a, b) =>
			a.name.localeCompare(b.name)
		);
	}

	// Filtering based on search and showSelected (apply to each meal type separately)
	const filteredRecipesByMealType = Object.entries(recipesByMealType).reduce(
		(acc, [mealType, recipes]) => {
			const filteredRecipes = recipes.filter((recipe) => {
				const searchTerm = searchQuery.toLowerCase();
				const recipeValues = Object.values(recipe);

				if (showSelected) {
					return selectedRecipeIds.includes(recipe.id);
				}

				return recipeValues.some((value) => {
					if (typeof value === "string") {
						return value.toLowerCase().includes(searchTerm);
					} else if (Array.isArray(value)) {
						return value.some((item) =>
							Object.values(item).some(
								(propValue) =>
									typeof propValue === "string" &&
									propValue.toLowerCase().includes(searchTerm)
							)
						);
					}
					return false;
				});
			});
			// Only add meal types with filtered recipes to the result
			if (filteredRecipes.length > 0) {
				acc[mealType] = filteredRecipes;
			}
			return acc;
		},
		{} as { [mealType: string]: RecipeModel[] }
	);
	// Keep preferred ordering from mealTypeOrder, then append any additional meal types found
	const preferred = mealTypeOrder.filter((mealType) =>
		Object.prototype.hasOwnProperty.call(
			filteredRecipesByMealType,
			mealType
		)
	);
	const remaining = Object.keys(filteredRecipesByMealType)
		.filter((mt) => !preferred.includes(mt))
		.sort();
	const orderedMealTypes = [...preferred, ...remaining];
	// Handling recipe selection
	const handleRecipeClick = (recipeId: string) => {
		setSelectedRecipeId(recipeId || null);
	};

	// Handling checkbox changes for selected recipes
	/* 	const handleSelectedRecipesChange = (recipe: RecipeModel) => {
		setSelectedRecipeIds((prevSelected) => {
			if (prevSelected.includes(recipe.id)) {
				return prevSelected.filter((id) => id !== recipe.id)
			} else {
				return [...prevSelected, recipe.id]
			}
		})
	} */

	// Load selected recipes from local storage on component mount
	useEffect(() => {
		const storedSelectedRecipeIds =
			localStorage.getItem("selectedRecipeIds");
		if (storedSelectedRecipeIds) {
			setSelectedRecipeIds(JSON.parse(storedSelectedRecipeIds));
		}
	}, [setSelectedRecipeIds]);

	// Save selected recipes to local storage whenever it changes
	useEffect(() => {
		localStorage.setItem(
			"selectedRecipeIds",
			JSON.stringify(selectedRecipeIds)
		);
	}, [selectedRecipeIds]);
	// Effect to trigger ingredient addition when selected recipes change
	useEffect(() => {
		// Check for newly added recipe
		const newRecipeId = selectedRecipeIds.find(
			(id) => !prevSelectedRecipeIds.current.includes(id)
		);

		if (newRecipeId) {
			const newRecipe = recipes.find((r) => r.id === newRecipeId);
			if (newRecipe) {
				// Pass the new recipe to the parent (App) for adding ingredients
				// Assuming App has a function like onAddRecipeIngredients
				// onAddRecipeIngredients(newRecipe);
			}
		}

		// Update the ref for the next comparison
		prevSelectedRecipeIds.current = selectedRecipeIds;
	}, [selectedRecipeIds, recipes]);

	// Removed automatic cleaning on mount - use manual clean button if needed
	// useEffect(() => {
	// 	const cleanServerRecipes = async () => {
	// 		try {
	// 			const response = await apiClient.post<{ message: string }>(`/api/clean-recipes`)
	// 			if (response.status !== 200) {
	// 				throw new Error("Failed to fix recipe data on server")
	// 			}
	// 			console.log(response.data.message) // Log the success message
	// 			// Optionally, refetch the recipe data from your server or local file
	// 			// after the data has been fixed.
	// 		} catch (error) {
	// 			console.error(error)
	// 		}
	// 	}

	// 	cleanServerRecipes() // Fix data initially on mount
	// }, [])

	/* 	const cleanServerRecipes = async () => {
		try {
			const response = await fetch("/api/clean-recipes", {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			})
			if (response.ok) {
				const data = await response.json()
				setRecipes(data)
				console.log(data.message)
			} else {
				throw new Error("Failed to fetch recipes.")
			}
			// Log the success message
			// Optionally, refetch the recipe data from your server or local file
			// after the data has been fixed.
		} catch (error) {
			console.error("Error fetching recipes: ", error)
		}
	} */

	/* 	useEffect(() => {
		const eventSource = new EventSource(
			"/recipes-stream"
		)

		eventSource.onmessage = (event) => {
			const data = JSON.parse(event.data)
			if (data.type === "recipe-update") {
				setRecipes(data.data)
			} else if (data.type === "ping") {
				// Handle ping event (optional, but recommended for long-lived connections)
				console.log("Received ping from server")
			}
		}

		eventSource.onerror = (error) => {
			console.error("EventSource failed:", error)
			eventSource.close()
		}

		return () => {
			eventSource.close() // Clean up on unmount
		}
	}, []) */

	/* 	const handleAdd = async (newRecipe: RecipeModel) => {
		try {
			const response = await fetch("/api/clean-recipe", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(newRecipe),
			})
			if (!response.ok) {
				throw new Error("Failed to clean recipe on server.")
			}
			const cleanedNewRecipe = await response.json()
			setRecipes((prevRecipes) => [...prevRecipes, cleanedNewRecipe])
		} catch (error) {
			console.error(error)
		}
	} */

	return (
		<div className="recipes-container">
			<div className="recipes-filter">
				<input
					type="text"
					placeholder="Search recipes..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
				<label>
					<input
						type="checkbox"
						checked={showSelected}
						onChange={() => setShowSelected(!showSelected)}
					/>
					Show Selected Recipes
				</label>
			</div>
			<div className="recipes-box">
				{isLoading ? ( // Loading indicator
					<div>Loading...</div>
				) : (
					<>
						<div className="recipes-index">
							<h2>Index</h2>
							{/* Render each meal type as a separate section */}
							{orderedMealTypes.map((mealType) => (
								<div className="mealType" key={mealType}>
									<h3>{mealType}</h3>
									<ul className="recipe-list">
										{filteredRecipesByMealType[
											mealType
										].map((recipe) => (
											<li key={recipe.id}>
												<Link
													to={`/recipes/${recipe.id}`}
													state={{ recipe }}
													onClick={() =>
														handleRecipeClick(
															recipe.id
														)
													}
												>
													{recipe.name}
												</Link>
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
};

export default RecipesIndex;
