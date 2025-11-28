interface RecipeItem {
  id: number;
  name: string;
  quantity: number;
  unit?: string;
}

interface RecipeModel {
  name: string;
  "unique id": number;
  id: string;
  cuisine: string;
  "meal type": string;
  "dietary restrictions and designations": string[];
  "serving info": {
    "prep time": string;
    "cook time": string;
    "total time": string;
    "number of people served": number;
  };
  ingredients: {
    [category: string]: RecipeItem[];
  };
  instructions: {
    number: number;
    text: string;
  }[];
  notes: string[];
  nutrition: {
    [key: string]: string;
  };
}

/**
 * Clean and validate recipe data
 */
export function cleanRecipe(recipe: any): any {
  if (!recipe) throw new Error("Recipe data is required");

  const out: any = { ...recipe };

  // uniqueId canonical - handle both formats
  if (!out.uniqueId && !out.unique_id) {
    if (out["unique id"]) out.unique_id = out["unique id"];
    else out.unique_id = Date.now();
  } else if (out.uniqueId && !out.unique_id) {
    out.unique_id = out.uniqueId;
  }

  // mealType canonical - handle both formats
  if (!out.mealType && !out.meal_type) {
    if (out["meal type"]) out.meal_type = out["meal type"];
    else out.meal_type = "Other";
  } else if (out.mealType && !out.meal_type) {
    out.meal_type = out.mealType;
  }

  // slug
  if (!out.slug) {
    out.slug = String(out.name || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-");
  }

  // dietaryRestrictions - handle both formats
  if (!out.dietaryRestrictions && !out.dietary_restrictions) {
    if (Array.isArray(out["dietary restrictions and designations"])) {
      out.dietary_restrictions = out["dietary restrictions and designations"];
    } else {
      out.dietary_restrictions = [];
    }
  } else if (out.dietaryRestrictions && !out.dietary_restrictions) {
    out.dietary_restrictions = out.dietaryRestrictions;
  }

  // servingInfo - handle both formats and map to snake_case
  if (!out.servingInfo && !out.serving_info) {
    if (out["serving info"]) {
      const si = out["serving info"];
      out.serving_info = {
        prep_time: si["prep time"] || "",
        cook_time: si["cook time"] || "",
        total_time: si["total time"] || "",
        servings: si["number of people served"] || 0,
      };
    } else {
      out.serving_info = {
        prep_time: "",
        cook_time: "",
        total_time: "",
        servings: 0,
      };
    }
  } else if (out.servingInfo && !out.serving_info) {
    out.serving_info = {
      prep_time: out.servingInfo.prepTime || out.servingInfo.prep_time || "",
      cook_time: out.servingInfo.cookTime || out.servingInfo.cook_time || "",
      total_time: out.servingInfo.totalTime || out.servingInfo.total_time || "",
      servings: out.servingInfo.servings || 0,
    };
  }

  // ingredients
  if (!out.ingredients || typeof out.ingredients !== "object")
    out.ingredients = { dish: [] };
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

  // instructions
  if (!Array.isArray(out.instructions)) out.instructions = [];
  out.instructions = out.instructions.map(
    (instruction: any, index: number) => ({
      ...instruction,
      stepNumber: instruction.stepNumber || instruction.number || index + 1,
    })
  );

  if (!Array.isArray(out.notes)) out.notes = [];
  if (!out.nutrition || typeof out.nutrition !== "object") out.nutrition = {};

  return out;
}

export default {
  cleanRecipe,
};
