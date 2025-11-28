import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ API_KEY not found in environment variables");
  console.log(
    "Available env vars:",
    Object.keys(process.env)
      .filter((k) => k.includes("API"))
      .join(", ")
  );
  process.exit(1);
}

console.log("✅ API_KEY found");
console.log("Key preview:", apiKey.slice(0, 10) + "..." + apiKey.slice(-4));

const genAI = new GoogleGenerativeAI(apiKey);

// Sample OCR text for testing
const sampleOcrText = `
=== Recipe Image ===
INGREDIENTS
Yield: 4 servings

For the Chicken
6 garlic cloves, finely grated
3 tablespoons soy sauce
1 tablespoon aji amarillo paste
1 tablespoon lime juice
1 teaspoon ground cumin
1 teaspoon black pepper
1/2 teaspoon salt
1 (3½- to 4-pound) chicken, halved

For the Sauce
1 cup cilantro leaves
3 jalapenos, seeded and diced
¼ cup feta cheese, crumbled
1 garlic clove, chopped
1½ tablespoons lime juice
2 teaspoons fresh oregano
¼ cup olive oil

PREPARATION

Step 1
In a large bowl, whisk together garlic, soy sauce, 
aji amarillo paste, lime juice, mustard, cumin,
pepper and salt.

Step 2
Add chicken halves, turning to coat with marinade.
Cover and refrigerate at least 2 hours.

Step 3
Heat oven to 450 degrees. Remove chicken from 
marinade and pat dry. Arrange on baking sheet.

Step 4
Roast until golden, 35 to 45 minutes.

@ cooking.nytimes.com
`;

const prompt = `Extract recipe data from OCR text and return ONLY valid JSON. NO markdown, NO code blocks, NO explanations.

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
${sampleOcrText}

JSON:`;

async function testGemini() {
  try {
    console.log("\n🔄 Testing Gemini API...\n");

    // First, list available models
    console.log("📋 Listing available models...");
    try {
      const listResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      const models = await listResponse.json();
      console.log("Available models:");
      if (models.models) {
        models.models.forEach((m: any) => {
          console.log(`  - ${m.name} (${m.displayName})`);
        });
      }
    } catch (listErr) {
      console.warn("Could not list models:", listErr);
    }

    // Try different model names
    const modelNames = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-flash-latest",
      "gemini-pro-latest",
    ];

    let model;
    let modelName;

    for (const name of modelNames) {
      try {
        console.log(`\n🔍 Trying model: ${name}...`);
        model = genAI.getGenerativeModel({ model: name });
        modelName = name;
        console.log(`✅ Model initialized: ${name}`);
        break;
      } catch (err) {
        console.log(`❌ Failed: ${name}`);
      }
    }

    if (!model) {
      throw new Error("No working model found");
    }
    console.log("\n📤 Sending prompt to Gemini...");
    console.log("Prompt length:", prompt.length, "characters");
    console.log("OCR text length:", sampleOcrText.length, "characters");

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    console.log("\n📥 Received response from Gemini");
    console.log("Response length:", response.length, "characters");
    console.log("\n--- RAW RESPONSE ---");
    console.log(response);
    console.log("--- END RAW RESPONSE ---\n");

    // Try to clean and parse
    let jsonText = response.trim();
    console.log("🧹 Cleaning response...");

    if (jsonText.startsWith("```json")) {
      console.log("  - Removing ```json prefix");
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith("```")) {
      console.log("  - Removing ``` prefix");
      jsonText = jsonText.slice(3);
    }

    if (jsonText.endsWith("```")) {
      console.log("  - Removing ``` suffix");
      jsonText = jsonText.slice(0, -3);
    }

    jsonText = jsonText.trim();
    console.log("Cleaned JSON length:", jsonText.length, "characters");

    console.log("\n🔍 Attempting to parse JSON...");
    const parsed = JSON.parse(jsonText);

    console.log("\n✅ SUCCESS! Parsed recipe data:");
    console.log("  Name:", parsed.name);
    console.log("  Cuisine:", parsed.cuisine);
    console.log("  Meal Type:", parsed.mealType);
    console.log("  Servings:", parsed.servingInfo?.servings);
    console.log(
      "  Ingredient categories:",
      Object.keys(parsed.ingredients || {}).join(", ")
    );
    console.log("  Number of instructions:", parsed.instructions?.length);

    console.log("\n--- PARSED JSON ---");
    console.log(JSON.stringify(parsed, null, 2));
    console.log("--- END PARSED JSON ---\n");

    // Validate structure
    console.log("\n✔️ Validation:");
    console.log("  - Has name:", !!parsed.name);
    console.log(
      "  - Has ingredients:",
      !!parsed.ingredients && Object.keys(parsed.ingredients).length > 0
    );
    console.log(
      "  - Has instructions:",
      !!parsed.instructions && parsed.instructions.length > 0
    );
    console.log("  - Has servingInfo:", !!parsed.servingInfo);

    console.log("\n🎉 All tests passed!");
  } catch (error) {
    console.error("\n❌ ERROR:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    process.exit(1);
  }
}

testGemini();
