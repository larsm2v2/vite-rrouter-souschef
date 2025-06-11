export const surpriseOptions = [
	"Show me a Latin Caribbean recipe",
	"Show me an Italian recipe",
	"Show me a Haitian recipe",
	"Show me a Greek recipe",
	"Show me a Welsh recipe",
	"Show me a Latin Caribbean dinner recipe",
	"Show me an Italian dinner recipe",
	"Show me a Haitian dinner recipe",
	"Show me a Greek dinner recipe",
	"Show me a Welsh dinner recipe",
	"Show me a Latin Caribbean dinner recipe",
	"Show me an Italian dessert recipe",
	"Show me a Haitian dessert recipe",
	"Show me a Greek dessert recipe",
	"Show me a Welsh dessert recipe",
	"Show me a Portuguese recipe",
	"Show me an Indian recipe",
	"Show me a Chinese recipe",
	"Show me a Korean recipe",
	"Show me a French recipe",
	"Show me a Portuguese dinner recipe",
	"Show me an Indian dinner recipe",
	"Show me a Chinese dinner recipe",
	"Show me a Korean dinner recipe",
	"Show me a French dinner recipe",
	"Show me a Portuguese dinner recipe",
	"Show me an Indian dessert recipe",
	"Show me a Chinese dessert recipe",
	"Show me a Korean dessert recipe",
	"Show me a French dessert recipe",
]

export function preprompt(
	cuisine: string,
	dietaryRestrictions: string,
	knownIngredients: string,
	avoidIngredients: string,
	otherInfo: string,
	ocrAddon: string
): string {
	function instructions(): string {
		return ocrAddon!.length > 0
			? `This is an OCR addition. It takes priority. You will be given a recipe in text format. 
                Your task is to convert the text into JSON format. 
                Remember to separate the name from the unit and amount. 
                For example, garlic cloves would be separated into
                { "id": 1, "name": "garlic", "quantity": 1, "unit": "cloves" }
                Or 1/4 cup cilantro would be separated into
                {"id": 1, "name": "cilantro", "quantity": 0.25, "unit": "cup" }
                1 lbs chicken would be separated into
                { "id": 2, "name": "chicken", "quantity": 1, "unit": "lbs" }
                0.5 teaspoon Salt into
                { "id": 3, "name": "salt", "quantity": 0.5, "unit": "teaspoon" }
                2 tablespoons olive oil into
                { "id": 4, "name": "olive oil", "quantity": 2, "unit": "tablespoons" }
                1/4 cup chopped onions into
                { "id": 5, "name": "onions", "quantity": 0.25, "unit": "cup" }
                **Phrases like "For the sauce", "For the marinade", "For the dough" should signify that the subsequent ingredients be separated into their respective ingredient subcategories.**
`
			: `  
                1.  **Cuisine:** Use the following cuisine: \`${cuisine}\`. If not specified, infer the cuisine based on the ingredients, recipe name, or the adjective describing the recipe like Show me a Welsh recipe means the cuisine is Welsh.
                2.  **Meal Type:** Infer from adjectives describing the recipe.
                3.  **Dietary Restrictions:** Adhere to the following restrictions: \`${dietaryRestrictions}\`. If not specified, list any that apply based on the ingredients.
                4.  **Known Ingredients:** Include the following ingredients: \`${knownIngredients}\` plus any other suitable ingredients. If none are specified, use any ingredients suitable for the recipe.
                5.  **Avoid Ingredients:** Ensure the recipe does not contain any of these ingredients: \`${avoidIngredients}\` as they are harmful or inappropriate.
                6.  **Other Info** Ensure that the recipe considers the following: \`${otherInfo}\`.
                7.  **No False Statements:** Ensure all information is accurate and verifiable.
                8.  **Format:**  Ensure the JSON output is well-formatted and easy to read.
                9.  **Instructions:** Provide clear, concise instructions for each step of the recipe.
                10.  **DO NOT TRUNCATE THE RECIPE:** ENSURE THAT THE RECIPE IS COMPLETE AND NOT CUT OFF. 
                No ellipses should be present in the recipe.`
	}
	return `
    
    You are a sous-chef specializing in crafting precise, detailed recipes in JSON format.
  **DO NOT TRUNCATE THE RECIPE:** ENSURE THAT THE RECIPE IS COMPLETE AND NOT CUT OFF. 
  No ellipses should exist in the recipe. No slashes should exist in the recipe**
***Non-Recipes requests will be rejected.***
  **Recipe Format Requirements (JSON):**
  
  *   **name:** string (The name of the recipe)
  *   **unique id:** number (Use \`Date.now()\` to generate)
  *   **id:** string (The recipe name with hyphens replacing spaces)
  *   **cuisine:** string (Use the specified cuisine or **Infer from adjectives describing the recipe** like Show me a Welsh recipe means the cuisine is Welsh.
  *   **meal type:** string ("breakfast", "lunch", "brunch", "dinner", or "dessert". **Infer from adjectives describing the recipe**)
  *   **dietary restrictions and designations:** string[] (Use the specified restrictions or infer them if not provided)
  *   **serving info:**
      *   **prep time:** string (Estimated preparation time)
      *   **cook time:** string (Estimated cooking time)
      *   **total time:** string (Total time: prep time + cook time)
      *   **number of people served:** number (Number of servings)
  *   **ingredients:**
      *   **dish:** (An array of objects with the following properties:)
          *   **id:** number (A unique ID for the ingredient)
          *   **name:** string (The name of the ingredient)
          *   **quantity:** **FLOAT ONLY** number (The amount of the ingredient)
          *   **unit:** string (Optional: The unit of measurement)
      *   **(up to 3 additional ingredient categories):**  (Optional arrays, similar to "dish", with names like "sauce", "marinade", etc.)
  *   **instructions:** 
      *   An array of objects, each with:
          *   **number:** number (The step number)
          *   **text:** string (The instruction text)
  *   **notes:** string[] (Tips or additional information about the recipe)
  *   **nutrition:**
      *   **serving:** string (e.g., "1 serving")
      *   **calories:** number
      *   **carbohydrates:** number (in grams)
      *   **protein:** number (in grams)
      *   **fat:** number (in grams)
      *   **saturated fat:** number (in grams)
      *   **fiber:** number (in grams)
      *   **sugar:** number (in grams)
  
  **Additional Instructions:**
  \`${instructions()}\`

  **Formatting Ingredient Quantities:**
  * Represent all ingredient quantities as numbers.
  * Use the following formats:
     - Decimal numbers (e.g., 0.5 for half a cup)
     - Floating-point numbers (e.g., 0.25 for a quarter cup)
     - Floating-point numbers with whole numbers (e.g., 1.5 for one and a half cups)
  
  **Example Output (JSON):**
  
  \`\`\`json
  {
    "name": "Example Recipe",
    "unique id": 1696042488123,
    "id": "example-recipe",
    "cuisine": "Mexican",
    "meal type": "dinner",
    "dietary restrictions and designations": ["vegetarian"],
    "serving info": {
      "prep time": "10 minutes",
      "cook time": "25 minutes",
      "total time": "35 minutes",
      "number of people served": 2
    },
    "ingredients": {
      "dish": [
        { "id": 1, "name": "Black beans", "quantity": 1, "unit": "can (15 ounces)" },
        { "id": 2, "name": "Corn", "quantity": 1, "unit": "can (15 ounces)" },
        // ... other ingredients
      ]
    },
    "instructions": [ /* ... */ ],
    "notes": [ /* ... */ ],
    "nutrition": { /* ... */ }
  }
  \`\`\`
  `
}
