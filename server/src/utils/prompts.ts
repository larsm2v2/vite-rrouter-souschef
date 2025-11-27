// Recipe parsing prompts for AI models

// Recipe JSON schema for consistent output format
export const RECIPE_SCHEMA = `{
  "name": string,
  "cuisine": string,
  "mealType": string,
  "dietaryRestrictions": string[],
  "servingInfo": {
    "prepTime": string,
    "cookTime": string,
    "totalTime": string,
    "servings": number
  },
  "ingredients": {
    [category: string]: Array<{
      "id": number,
      "name": string,
      "quantity": number,
      "unit": string
    }>
  },
  "instructions": Array<{
    "number": number,
    "text": string
  }>,
  "notes": string[],
  "nutrition": {
    "serving": string,
    "calories": number,
    "carbohydrates": number,
    "protein": number,
    "fat": number,
    "saturatedFat": number,
    "fiber": number,
    "sugar": number
  }
}`;

/**
 * Generate a prompt for parsing OCR text into structured recipe JSON
 * @param ocrText - The raw OCR text to parse
 * @returns Formatted prompt string for AI model
 */
export function ocrParsePrompt(ocrText: string): string {
  return `You are a recipe parser specializing in extracting structured recipe data from OCR text.

Parse the following recipe text into structured JSON format. Extract:

1. **name**: Recipe name (string)
2. **cuisine**: Type of cuisine (string, e.g., "Italian", "Mexican", "French")
3. **mealType**: One of: "breakfast", "lunch", "brunch", "dinner", "dessert"
4. **ingredients**: Object with categories as keys and arrays of ingredient objects as values
   - Separate ingredients by category (e.g., "dish", "sauce", "marinade", "dough")
   - Look for phrases like "For the sauce", "For the marinade" to identify categories
   - Each ingredient must have:
     * **id**: number (sequential starting at 1 within each category)
     * **name**: string (ingredient name, lowercase, without quantities)
     * **quantity**: number (as decimal, e.g., 0.25 for 1/4, 1.5 for 1½)
     * **unit**: string (e.g., "cup", "tablespoon", "teaspoon", "lbs", "cloves")
5. **instructions**: Array of step objects with:
   - **number**: step number (sequential starting at 1)
   - **text**: instruction text (string)
6. **servingInfo**: Object with:
   - **prepTime**: string (e.g., "15 minutes")
   - **cookTime**: string (e.g., "30 minutes")
   - **totalTime**: string (e.g., "45 minutes")
   - **servings**: number of servings
7. **notes**: Array of additional notes or tips (string[])

**Ingredient Parsing Rules:**
- Convert fractions to decimals: 1/4 → 0.25, 1/2 → 0.5, 1/3 → 0.33, 2/3 → 0.67
- Separate quantity, unit, and name: "2 cups flour" → {quantity: 2, unit: "cup", name: "flour"}
- Remove descriptors from name: "chopped onions" → {name: "onions"}
- Standardize units: tbsp → tablespoon, tsp → teaspoon, oz → ounce
- Handle ranges: "1-2 cups" → use midpoint (1.5)

**Important:**
- Return ONLY valid JSON, no markdown formatting, no code blocks
- If information is missing, use reasonable defaults or null
- Preserve the original instruction order and wording
- Ensure all quantities are numeric (not strings)
- Group related ingredients by category when possible

Recipe text:
${ocrText}

Return the parsed recipe as JSON:`;
}

/**
 * Generate a prompt for recipe generation with custom parameters
 * @param params - Recipe generation parameters
 * @returns Formatted prompt string for AI model
 */
export interface RecipeGenerationParams {
  cuisine?: string;
  dietaryRestrictions?: string;
  knownIngredients?: string;
  avoidIngredients?: string;
  otherInfo?: string;
  mealType?: string;
}

export function recipeGenerationPrompt(
  params: RecipeGenerationParams = {}
): string {
  const {
    cuisine = "",
    dietaryRestrictions = "",
    knownIngredients = "",
    avoidIngredients = "",
    otherInfo = "",
    mealType = "",
  } = params;

  return `You are a sous-chef specializing in crafting precise, detailed recipes in JSON format.

**Recipe Requirements:**
${cuisine ? `- **Cuisine**: ${cuisine}` : "- **Cuisine**: Infer from context"}
${
  mealType
    ? `- **Meal Type**: ${mealType}`
    : "- **Meal Type**: Infer from context (breakfast, lunch, brunch, dinner, dessert)"
}
${
  dietaryRestrictions
    ? `- **Dietary Restrictions**: ${dietaryRestrictions}`
    : ""
}
${knownIngredients ? `- **Include Ingredients**: ${knownIngredients}` : ""}
${avoidIngredients ? `- **Avoid Ingredients**: ${avoidIngredients}` : ""}
${otherInfo ? `- **Additional Info**: ${otherInfo}` : ""}

**Recipe Format (JSON):**
Use the following schema:
${RECIPE_SCHEMA}

**Important Rules:**
- Return ONLY valid JSON, no markdown code blocks
- Ensure all ingredient quantities are numbers (decimals, not fractions)
- Provide clear, numbered instructions
- Include accurate nutrition information
- Do not truncate or use ellipses
- Ensure recipe is complete and verifiable

Return the recipe as JSON:`;
}
