import React, { useState, useEffect } from "react"
import "./ShoppingList.css"
import { RecipeModel } from "../Models/Models"
import EditableList from "./EditableList/EditableList"
import shoppingListData from "./ShoppingList.json"
import { ListItem } from "../Models/Models"

interface ShoppingListProps {
	selectedRecipeIds: string[]
}

// Fetch recipe by ID (from the imported Recipes.json)
/* const fetchRecipeById = (recipeId: string): RecipeModel | null => {
	const recipe = (recipeData as RecipeModel[]).find(
		(recipe) => recipe.id === recipeId
	)
	if (!recipe) return null

	const fixedRecipe = {
		...recipe,
		"serving info": {
			...recipe["serving info"],
			"prep time": recipe["serving info"]["prep time"] || "", // Replace null with empty string
			"total time": recipe["serving info"]["total time"] || "", // Replace null with empty string
			"number of people served":
				parseInt(
					recipe["serving info"]["number of people served"] as string,
					10
				) || 0, // Convert to number or default to 0
		},
	}

	return fixedRecipe as RecipeModel
} */
const ShoppingList: React.FC<ShoppingListProps> = ({
	selectedRecipeIds = [],
}) => {
	const [, setRecipeIngredients] = useState<{
		[recipeId: string]: ListItem[]
	}>({})
	const [recipes, setRecipes] = useState<RecipeModel[]>([])
	const [listItems, setListItems] = useState<ListItem[]>(
		shoppingListData.map((item) => ({
			...item,
			listItem: item.item,
			isDone: false,
			toTransfer: false,
		}))
	)
	/* 	const [newItem, setNewItem] = useState<ListItem>({
		id: Date.now(),
		quantity: 0,
		unit: "",
		listItem: "",
		isDone: false,
		toTransfer: false,
	}) */
	const [ingredientSynonyms, setIngredientSynonyms] = useState<{
		[key: string]: string[]
	}>({})
	//Clean and Fetch Backend Recipes
	useEffect(() => {
		const fetchRecipes = async () => {
			try {
				const response = await fetch(`/api/clean-recipes`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
				})

				if (response.ok) {
					const data = await response.json()
					setRecipes(data.data) // Update recipes state
				} else {
					throw new Error("Failed to fetch recipes.")
				}
			} catch (error) {
				console.error("Error fetching recipes:", error)
			}
		}

		fetchRecipes() // Fetch recipes on component mount
	}, [])
	// Fetch Ingredient Synonyms
	useEffect(() => {
		const fetchIngredientSynonyms = async () => {
			try {
				const response = await fetch(`/api/ingredient-synonyms`, {
					method: "GET",
					headers: {
						"Content-Type": "application/json",
					},
				})
				if (response.ok) {
					const data = await response.json()
					setIngredientSynonyms(data)
				} else {
					throw new Error("Failed to fetch ingredient synonyms.")
				}
			} catch (error) {
				console.error("Error fetching ingredient synonyms:", error)
			}
		}

		fetchIngredientSynonyms()
	}, [])
	// Helper function to consolidate ingredients
	/* 	const consolidateIngredients = (
		listItems: ListItem[],
		newItems: ListItem[],
		removingRecipe?: RecipeModel
	): ListItem[] => {
		return [...listItems, ...(newItems || [])]
			.reduce((acc: ListItem[], currentItem) => {
				const existingItem = acc.find(
					(item) =>
						item.listItem === currentItem.listItem &&
						item.unit.replace(/s$/, "") ===
							currentItem.unit.replace(/s$/, "")
				)

				if (existingItem) {
					if (removingRecipe) {
						// If removing a recipe, subtract ingredient quantity
						const recipeIngredient =
							removingRecipe.ingredients.dish.find(
								(ing) => ing.name === currentItem.listItem
							)
						existingItem.quantity = Math.max(
							0,
							existingItem.quantity -
								(recipeIngredient?.quantity || 0)
						)
					} else {
						// If adding a recipe, add ingredient quantity
						existingItem.quantity += currentItem.quantity
					}
				} else {
					acc.push(currentItem)
				}
				return acc
			}, [] as ListItem[])
			.filter((item) => item.quantity > 0) // Remove items with zero quantity
	} */
	/* 	const handleAdd = (e: React.FormEvent) => {
		e.preventDefault()
		if (newItem.listItem.trim() !== "") {
			setListItems((prevItems) =>
				consolidateIngredients(prevItems, [newItem])
			)
			setNewItem({
				id: Date.now(),
				quantity: 0,
				unit: "",
				listItem: "",
				isDone: false,
				toTransfer: false,
			})
		}
	} */
	useEffect(() => {
		const updateShoppingList = async () => {
			const newRecipeIngredients: { [recipeId: string]: ListItem[] } = {}
			const validRecipeIds = selectedRecipeIds.filter(
				(recipeId) => recipeId !== null && recipeId !== ""
			)
			await Promise.all(
				validRecipeIds.map(async (recipeId) => {
					const recipe = recipes.find((r) => r.id === recipeId)
					if (recipe) {
						newRecipeIngredients[recipeId] = Object.values(
							recipe.ingredients
						)
							.flat()
							.map((ingredient) => {
								// Check for synonyms
								const standardizedName = Object.keys(
									ingredientSynonyms
								).find((key) => {
									const normalizedIngredientName =
										ingredient.name.toLowerCase().trim() // Normalize for better matching
									// Get the array of synonyms for the current key
									const synonymsForIngredient =
										ingredientSynonyms[key]
									return (
										Array.isArray(synonymsForIngredient) && // Ensure it's an array
										synonymsForIngredient.some(
											(synonym) =>
												synonym.toLowerCase().trim() ===
												normalizedIngredientName
										)
									)
								})
								return {
									id: Date.now() + Math.random(), // Generate a unique ID
									quantity: ingredient.quantity || 0,
									unit: ingredient.unit || "",
									listItem:
										standardizedName || ingredient.name,
									isDone: false,
									toTransfer: false,
								}
							})
					}
				})
			)

			setRecipeIngredients(newRecipeIngredients)
			const allIngredients = Object.values(newRecipeIngredients).flat()
			const uniqueIngredients = new Set<string>()
			const consolidatedList: ListItem[] = []

			allIngredients.forEach((ingredient) => {
				if (!uniqueIngredients.has(ingredient.listItem)) {
					uniqueIngredients.add(ingredient.listItem)
					consolidatedList.push(ingredient)
				} else {
					const existingItem = consolidatedList.find(
						(item) => item.listItem === ingredient.listItem
					)
					if (existingItem) {
						existingItem.quantity += ingredient.quantity
					}
				}
			})

			setListItems(consolidatedList)
		}

		updateShoppingList()
	}, [selectedRecipeIds, recipes, ingredientSynonyms])

	return (
		<div className="shoppinglist-container">
			<h1>myShoppingList</h1>
			<div className="flex-container">
				<div className="edit-box">
					<EditableList
						listItems={listItems}
						setListItems={setListItems}
					/>
				</div>
			</div>
		</div>
	)
}

export default ShoppingList
