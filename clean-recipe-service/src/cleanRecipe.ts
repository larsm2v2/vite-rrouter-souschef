export function cleanRecipe(recipe: any): any {
  if (!recipe || !recipe.name) {
    throw new Error("Recipe name is required");
  }

  // normalize base fields
  const out: any = { ...recipe };

  // uniqueId: prefer existing camelCase or snake/cased variants, otherwise create
  if (!out.uniqueId) {
    if (out["unique id"]) out.uniqueId = out["unique id"];
    else out.uniqueId = Date.now();
  }

  // slug / id
  if (!out.slug) {
    const name = String(out.name || "");
    out.slug = name.toLowerCase().trim().replace(/\s+/g, "-");
  }

  // dietaryRestrictions (camelCase) - accept older variants
  if (!out.dietaryRestrictions) {
    if (Array.isArray(out["dietary restrictions and designations"])) {
      out.dietaryRestrictions = out["dietary restrictions and designations"];
    } else if (Array.isArray(out.dietary_restrictions)) {
      out.dietaryRestrictions = out.dietary_restrictions;
    } else {
      out.dietaryRestrictions = [];
    }
  }

  // servingInfo - canonical shape with camelCase keys
  if (!out.servingInfo) {
    if (out.serving_info) {
      // map snake_case to camelCase expected by app
      const si = out.serving_info;
      out.servingInfo = {
        prepTime: si["prep time"] || si.prep_time || si.prepTime || "",
        cookTime: si["cook time"] || si.cook_time || si.cookTime || "",
        totalTime: si["total time"] || si.total_time || si.totalTime || "",
        servings:
          si["number of people served"] || si.servings || si.servings || 0,
      };
    } else if (out["serving info"]) {
      const si = out["serving info"];
      out.servingInfo = {
        prepTime: si["prep time"] || "",
        cookTime: si["cook time"] || "",
        totalTime: si["total time"] || "",
        servings: si["number of people served"] || 0,
      };
    } else {
      out.servingInfo = {
        prepTime: "",
        cookTime: "",
        totalTime: "",
        servings: 0,
      };
    }
  }

  // ingredients: ensure object with arrays and numeric quantities
  if (!out.ingredients || typeof out.ingredients !== "object") {
    out.ingredients = { dish: [] };
  }

  Object.keys(out.ingredients).forEach((category) => {
    if (Array.isArray(out.ingredients[category])) {
      out.ingredients[category] = out.ingredients[category].map(
        (item: any) => ({
          ...item,
          quantity: typeof item.quantity === "number" ? item.quantity : 0,
        })
      );
    } else {
      out.ingredients[category] = [];
    }
  });

  // instructions: ensure array and stepNumber field
  if (!Array.isArray(out.instructions)) {
    out.instructions = [];
  }
  out.instructions = out.instructions.map((instr: any, index: number) => {
    const stepNumber = instr.stepNumber || instr.number || index + 1;
    return { ...instr, stepNumber };
  });

  // notes and nutrition defaults
  if (!Array.isArray(out.notes)) out.notes = [];
  if (!out.nutrition || typeof out.nutrition !== "object") out.nutrition = {};

  return out;
}
