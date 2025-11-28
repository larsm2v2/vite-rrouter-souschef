"use strict";
// Recipe parsing prompts for AI models
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECIPE_SCHEMA = void 0;
exports.ocrParsePrompt = ocrParsePrompt;
exports.recipeGenerationPrompt = recipeGenerationPrompt;
// Recipe JSON schema for consistent output format
exports.RECIPE_SCHEMA = `{
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
function ocrParsePrompt(ocrText) {
    return `Extract recipe data from OCR text and return ONLY valid JSON. NO markdown, NO code blocks, NO explanations.

The OCR text contains noise (headers, footers, URLs, timestamps). IGNORE all non-recipe content.

Return this exact structure:
{
  "name": "Recipe Name",
  "cuisine": "Cuisine Type",
  "mealType": "dinner",
  "servingInfo": {
    "prepTime": "10 minutes",
    "cookTime": "30 minutes",
    "totalTime": "40 minutes",
    "servings": 4
  },
  "ingredients": {
    "chicken": [
      {"id": 1, "name": "garlic", "quantity": 6, "unit": "cloves"},
      {"id": 2, "name": "soy sauce", "quantity": 3, "unit": "tablespoon"}
    ],
    "sauce": [
      {"id": 1, "name": "cilantro", "quantity": 1, "unit": "cup"}
    ]
  },
  "instructions": [
    {"number": 1, "text": "In a large bowl, whisk together garlic, soy sauce..."},
    {"number": 2, "text": "Add chicken halves, turning to coat..."}
  ],
  "notes": ["Optional tip or note"]
}

RULES:
1. Convert fractions: ¼→0.25, ½→0.5, ⅓→0.33, ¾→0.75, 1½→1.5
2. Group ingredients by category from headers: "For the Chicken", "For the Sauce"
3. Clean ingredient names: "finely grated garlic" → "garlic", "chopped onions" → "onions"
4. Standardize units: tbsp→tablespoon, tsp→teaspoon, oz→ounce, lbs→pound
5. Ignore OCR noise: URLs (cooking.nytimes.com), UI text, timestamps
6. Return ONLY JSON - no markdown, no \`\`\`json blocks, no extra text

OCR Text:
${ocrText}

JSON:`;
}
function recipeGenerationPrompt(params = {}) {
    const { cuisine = "", dietaryRestrictions = "", knownIngredients = "", avoidIngredients = "", otherInfo = "", mealType = "", } = params;
    return `You are a sous-chef specializing in crafting precise, detailed recipes in JSON format.

**Recipe Requirements:**
${cuisine ? `- **Cuisine**: ${cuisine}` : "- **Cuisine**: Infer from context"}
${mealType
        ? `- **Meal Type**: ${mealType}`
        : "- **Meal Type**: Infer from context (breakfast, lunch, brunch, dinner, dessert)"}
${dietaryRestrictions
        ? `- **Dietary Restrictions**: ${dietaryRestrictions}`
        : ""}
${knownIngredients ? `- **Include Ingredients**: ${knownIngredients}` : ""}
${avoidIngredients ? `- **Avoid Ingredients**: ${avoidIngredients}` : ""}
${otherInfo ? `- **Additional Info**: ${otherInfo}` : ""}

**Recipe Format (JSON):**
Use the following schema:
${exports.RECIPE_SCHEMA}

**Important Rules:**
- Return ONLY valid JSON, no markdown code blocks
- Ensure all ingredient quantities are numbers (decimals, not fractions)
- Provide clear, numbered instructions
- Include accurate nutrition information
- Do not truncate or use ellipses
- Ensure recipe is complete and verifiable

Return the recipe as JSON:`;
}
