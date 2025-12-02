/* eslint-disable no-mixed-spaces-and-tabs */
import React from "react";
import { RecipeModel } from "../../Models/Models";
import "../Recipes.css";
import "../../SousChef/SousChef.css";
import "./RecipeDetails.css";

// Interface for ingredient groups
interface IngredientGroup {
  name: string;
  ingredients: {
    [subcategory: string]: {
      id: number;
      quantity: number;
      name: string;
      unit?: string;
    }[];
  }; // Assuming consistent ingredient structure
}

interface RecipeDetailsProps {
  isSelected: boolean;
  showRecipe: RecipeModel | null;
  onSelectedRecipesChange: (recipe: RecipeModel | null) => void;
  showAddToSelectedRecipes: boolean | null;
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
      .join(" ");
  };

  // Function to toggle selection and update parent component
  const handleCheckboxChange = () => {
    onSelectedRecipesChange(showRecipe);
  };

  // 1. Organize Ingredients by Subheading - use backend structure directly
  const ingredientGroups: IngredientGroup[] | null = showRecipe
    ? Object.entries(showRecipe.ingredients)
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

  return (
    <div className="recipe-content">
      {showRecipe && ingredientGroups && (
        <div className="recipes-container">
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
            <p>
              <strong>{capitalizeHeading("Meal Type")}:</strong>{" "}
              {capitalizeHeading(showRecipe.meal_type)}
            </p>
          </div>

          {/* 3. Display Ingredients by Subheading (with capitalized headings) */}
          <section id="ingredients">
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
                                ingredient.name && ingredient.quantity
                            )
                            .map((ingredient) => (
                              <li key={ingredient.id}>
                                {`${ingredient.quantity} ${
                                  ingredient.unit ? ingredient.unit : ""
                                } ${ingredient.name}`}
                              </li>
                            ))
                        : []
                  )}
                </ul>
              </div>
            ))}
          </section>

          {/* 4. Display Instructions (with capitalized heading) */}
          <section id="instructions">
            <h2>{capitalizeHeading("Instructions")}</h2>
            <ol className="instructionSet">
              {showRecipe.instructions.map((instruction) => (
                <li className="singleInstructions" key={instruction.number}>
                  {instruction.text}
                </li>
              ))}
            </ol>
          </section>

          {/* 5. Display Notes if available */}
          {showRecipe.notes && showRecipe.notes.length > 0 && (
            <section id="notes">
              <h2>{capitalizeHeading("Notes")}</h2>
              <ul>
                {showRecipe.notes.map((note, index) => (
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
