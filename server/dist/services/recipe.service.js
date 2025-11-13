"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanRecipe = cleanRecipe;
/**
 * Clean and validate recipe data
 */
function cleanRecipe(recipe) {
    if (!recipe)
        throw new Error("Recipe data is required");
    const out = Object.assign({}, recipe);
    // uniqueId canonical
    if (!out.uniqueId) {
        if (out["unique id"])
            out.uniqueId = out["unique id"];
        else
            out.uniqueId = Date.now();
    }
    // slug
    if (!out.slug) {
        out.slug = String(out.name || "").toLowerCase().trim().replace(/\s+/g, "-");
    }
    // dietaryRestrictions
    if (!out.dietaryRestrictions) {
        if (Array.isArray(out["dietary restrictions and designations"])) {
            out.dietaryRestrictions = out["dietary restrictions and designations"];
        }
        else {
            out.dietaryRestrictions = [];
        }
    }
    // servingInfo (map variants)
    if (!out.servingInfo) {
        if (out["serving info"]) {
            const si = out["serving info"];
            out.servingInfo = {
                prepTime: si["prep time"] || "",
                cookTime: si["cook time"] || "",
                totalTime: si["total time"] || "",
                servings: si["number of people served"] || 0,
            };
        }
        else {
            out.servingInfo = { prepTime: "", cookTime: "", totalTime: "", servings: 0 };
        }
    }
    // ingredients
    if (!out.ingredients || typeof out.ingredients !== "object")
        out.ingredients = { dish: [] };
    Object.keys(out.ingredients).forEach((category) => {
        if (Array.isArray(out.ingredients[category])) {
            out.ingredients[category] = out.ingredients[category].map((item) => (Object.assign(Object.assign({}, item), { quantity: typeof item.quantity === "number" ? item.quantity : 0 })));
        }
        else {
            out.ingredients[category] = [];
        }
    });
    // instructions
    if (!Array.isArray(out.instructions))
        out.instructions = [];
    out.instructions = out.instructions.map((instruction, index) => (Object.assign(Object.assign({}, instruction), { stepNumber: instruction.stepNumber || instruction.number || index + 1 })));
    if (!Array.isArray(out.notes))
        out.notes = [];
    if (!out.nutrition || typeof out.nutrition !== "object")
        out.nutrition = {};
    return out;
}
exports.default = {
    cleanRecipe,
};
