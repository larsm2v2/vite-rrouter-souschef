"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanRecipe = cleanRecipe;
/**
 * Clean and validate recipe data
 */
function cleanRecipe(recipe) {
    if (!recipe) {
        throw new Error("Recipe data is required");
    }
    // Ensure unique id exists
    if (!recipe["unique id"]) {
        recipe["unique id"] = Date.now();
    }
    // Ensure id exists (slug)
    if (!recipe.id && recipe.name) {
        recipe.id = recipe.name.toLowerCase().replace(/\s+/g, "-");
    }
    // Ensure dietary restrictions is an array
    if (!recipe["dietary restrictions and designations"]) {
        recipe["dietary restrictions and designations"] = [];
    }
    // Ensure serving info exists
    if (!recipe["serving info"]) {
        recipe["serving info"] = {
            "prep time": "",
            "cook time": "",
            "total time": "",
            "number of people served": 0,
        };
    }
    // Ensure ingredients exist
    if (!recipe.ingredients) {
        recipe.ingredients = { dish: [] };
    }
    else {
        // Ensure all ingredients have numeric quantities
        Object.keys(recipe.ingredients).forEach((category) => {
            if (Array.isArray(recipe.ingredients[category])) {
                recipe.ingredients[category] = recipe.ingredients[category].map((item) => {
                    return Object.assign(Object.assign({}, item), { quantity: typeof item.quantity === "number" ? item.quantity : 0 });
                });
            }
            else {
                recipe.ingredients[category] = [];
            }
        });
    }
    // Ensure instructions exist and have number property
    if (!recipe.instructions) {
        recipe.instructions = [];
    }
    else {
        recipe.instructions = recipe.instructions.map((instruction, index) => {
            return Object.assign(Object.assign({}, instruction), { number: instruction.number || index + 1 });
        });
    }
    // Ensure notes is an array
    if (!recipe.notes) {
        recipe.notes = [];
    }
    // Ensure nutrition exists
    if (!recipe.nutrition) {
        recipe.nutrition = {};
    }
    return recipe;
}
exports.default = {
    cleanRecipe,
};
