import React, { useState, useEffect, useRef } from "react"
import "./Recipes.css"
import { RecipeModel } from "../Models/Models"

interface RecipesIndexProps {
	isLoading: boolean
	setIsLoading: (loading: boolean) => void
	selectedRecipeIds: string[]
	setSelectedRecipeIds: React.Dispatch<React.SetStateAction<string[]>>
	setSelectedRecipeId: (recipeId: string | null) => void
}
/* 	selectedRecipe: RecipeModel | null
	setSelectedRecipe: React.Dispatch<React.SetStateAction<RecipeModel | null>> */

const RecipesIndex: React.FC<RecipesIndexProps> = ({
	selectedRecipeIds,
	setSelectedRecipeIds,
	setSelectedRecipeId,
	/* 	selectedRecipe,
	setSelectedRecipe, */
}) => {
	const [recipes, setRecipes] = useState<RecipeModel[]>([])
	const [searchQuery, setSearchQuery] = useState("")
	const [showSelected, setShowSelected] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const prevSelectedRecipeIds = useRef<string[]>(selectedRecipeIds)
	const mealTypeOrder = [
		"Breakfast",
		"Lunch",
		"Appetizer",
		"Dinner",
		"Dessert",
	]
	const fetchRecipes = async (
		setRecipes: React.Dispatch<React.SetStateAction<RecipeModel[]>>
	) => {
		try {
			const response = await fetch(`api/clean-recipes`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			})
			if (response.ok) {
				const data = await response.json()
				setRecipes(data.data) // Assuming the server sends the cleaned recipes in `data.data`
				console.log("JSON retrieved: ", data.data)
			} else {
				throw new Error("Failed to fetch recipes.")
			}
		} catch (error) {
			console.error("Error fetching recipes:", error)
		} finally {
			setIsLoading(false)
		}
	}

	useEffect(() => {
		// Fetch recipes when the component mounts
		fetchRecipes(setRecipes) // Call the function here
	}, [])
	// Filtering based on search and showSelected
	// Group recipes by meal type
	const recipesByMealType = recipes.reduce((acc, recipe) => {
		const mealType =
			recipe["meal type"].charAt(0).toUpperCase() +
			recipe["meal type"].slice(1) // Capitalize
		if (!acc[mealType]) {
			acc[mealType] = []
		}
		acc[mealType].push(recipe)
		return acc
	}, {} as { [mealType: string]: RecipeModel[] })

	// Sort recipes within each meal type alphabetically
	for (const mealType in recipesByMealType) {
		recipesByMealType[mealType].sort((a, b) => a.name.localeCompare(b.name))
	}

	// Filtering based on search and showSelected (apply to each meal type separately)
	const filteredRecipesByMealType = Object.entries(recipesByMealType).reduce(
		(acc, [mealType, recipes]) => {
			const filteredRecipes = recipes.filter((recipe) => {
				const searchTerm = searchQuery.toLowerCase()
				const recipeValues = Object.values(recipe)

				if (showSelected) {
					return selectedRecipeIds.includes(recipe.id)
				}

				return recipeValues.some((value) => {
					if (typeof value === "string") {
						return value.toLowerCase().includes(searchTerm)
					} else if (Array.isArray(value)) {
						return value.some((item) =>
							Object.values(item).some(
								(propValue) =>
									typeof propValue === "string" &&
									propValue.toLowerCase().includes(searchTerm)
							)
						)
					}
					return false
				})
			})
			// Only add meal types with filtered recipes to the result
			if (filteredRecipes.length > 0) {
				acc[mealType] = filteredRecipes
			}
			return acc
		},
		{} as { [mealType: string]: RecipeModel[] }
	)
	const orderedMealTypes = mealTypeOrder.filter((mealType) => {
		return (
			mealType &&
			Object.prototype.hasOwnProperty.call(
				filteredRecipesByMealType,
				mealType
			)
		)
	})
	// Handling recipe selection
	const handleRecipeClick = (recipeId: string) => {
		setSelectedRecipeId(recipeId || null)
	}

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
			localStorage.getItem("selectedRecipeIds")
		if (storedSelectedRecipeIds) {
			setSelectedRecipeIds(JSON.parse(storedSelectedRecipeIds))
		}
	}, [setSelectedRecipeIds])

	// Save selected recipes to local storage whenever it changes
	useEffect(() => {
		localStorage.setItem(
			"selectedRecipeIds",
			JSON.stringify(selectedRecipeIds)
		)
	}, [selectedRecipeIds])
	// Effect to trigger ingredient addition when selected recipes change
	useEffect(() => {
		// Check for newly added recipe
		const newRecipeId = selectedRecipeIds.find(
			(id) => !prevSelectedRecipeIds.current.includes(id)
		)

		if (newRecipeId) {
			const newRecipe = recipes.find((r) => r.id === newRecipeId)
			if (newRecipe) {
				// Pass the new recipe to the parent (App) for adding ingredients
				// Assuming App has a function like onAddRecipeIngredients
				// onAddRecipeIngredients(newRecipe);
			}
		}

		// Update the ref for the next comparison
		prevSelectedRecipeIds.current = selectedRecipeIds
	}, [selectedRecipeIds, recipes])

	useEffect(() => {
		const cleanServerRecipes = async () => {
			try {
				const response = await fetch(`/api/clean-recipes`, {
					method: "POST",
				})
				if (!response.ok) {
					throw new Error("Failed to fix recipe data on server")
				}
				const data = await response.json()
				console.log(data.message) // Log the success message
				// Optionally, refetch the recipe data from your server or local file
				// after the data has been fixed.
			} catch (error) {
				console.error(error)
			}
		}

		cleanServerRecipes() // Fix data initially on mount
	}, [])

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
			<div>
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
									<ul>
										{filteredRecipesByMealType[
											mealType
										].map((recipe) => (
											<li
												key={recipe.id}
												onClick={() =>
													handleRecipeClick(recipe.id)
												}
											>
												{recipe.name}
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
	)
}

export default RecipesIndex
