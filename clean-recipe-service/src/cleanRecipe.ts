export function cleanRecipe(recipe: any): any {
  if (!recipe.name) {
    throw new Error("Recipe name is required");
  }

  // Ensure slug exists
  if (!recipe.slug && recipe.name) {
    recipe.slug = recipe.name.toLowerCase().replace(/\s+/g, "-");
  }

  // Ensure ingredients exist
  if (!recipe.ingredients) {
    recipe.ingredients = {};
  } else {
    Object.keys(recipe.ingredients).forEach((category) => {
      if (Array.isArray(recipe.ingredients[category])) {
        recipe.ingredients[category] = recipe.ingredients[category].map(
          (item) => ({
            ...item,
            quantity: typeof item.quantity === "number" ? item.quantity : 0,
          })
        );
      } else {
        recipe.ingredients[category] = [];
      }
    });
  }

  // Ensure instructions exist
  if (!recipe.instructions) {
    recipe.instructions = [];
  } else {
    recipe.instructions = recipe.instructions.map((instruction, index) => ({
      ...instruction,
      stepNumber: instruction.stepNumber || index + 1,
    }));
  }

  return recipe;
}
