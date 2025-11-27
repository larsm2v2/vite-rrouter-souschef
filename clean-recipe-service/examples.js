/**
 * Examples of using the Clean Recipe Service synonym canonicalization
 *
 * Run the clean-recipe-service locally first:
 *   cd clean-recipe-service
 *   npm install
 *   npm run dev
 */

const SERVICE_URL =
  process.env.CLEAN_RECIPE_SERVICE_URL || "http://localhost:6000";

// Example 1: Single ingredient canonicalization
async function example1_canonicalizeSingleIngredient() {
  console.log("\n=== Example 1: Canonicalize Single Ingredient ===\n");

  const ingredients = [
    "black pepper",
    "extra virgin olive oil",
    "sea salt",
    "boneless chicken breast",
    "all-purpose flour",
  ];

  for (const ingredient of ingredients) {
    const response = await fetch(`${SERVICE_URL}/canonicalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredient }),
    });

    const result = await response.json();
    console.log(`Input: "${result.input}"`);
    console.log(`Canonical: "${result.canonical}"`);
    console.log(`Was Transformed: ${result.wasTransformed}`);
    console.log(`Has Variants: ${result.hasVariants}`);
    if (result.hasVariants) {
      console.log(`Variants: ${result.variants.join(", ")}`);
    }
    console.log("---");
  }
}

// Example 2: Batch canonicalization
async function example2_batchCanonicalization() {
  console.log("\n=== Example 2: Batch Canonicalization ===\n");

  const ingredients = [
    "black pepper",
    "evoo",
    "kosher salt",
    "minced beef",
    "yellow onion",
    "fresh basil",
    "unknown ingredient",
  ];

  const response = await fetch(`${SERVICE_URL}/canonicalize-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredients }),
  });

  const result = await response.json();

  console.log("Batch Results:");
  result.results.forEach(({ input, canonical }) => {
    const transformed = input.toLowerCase() !== canonical.toLowerCase();
    console.log(
      `  ${input.padEnd(25)} → ${canonical}${transformed ? " ✓" : ""}`
    );
  });
}

// Example 3: Get synonym statistics
async function example3_getSynonymStats() {
  console.log("\n=== Example 3: Synonym Statistics ===\n");

  const response = await fetch(`${SERVICE_URL}/synonym-stats`);
  const stats = await response.json();

  console.log(`Canonical Ingredients: ${stats.canonicalCount}`);
  console.log(`Total Variants: ${stats.totalVariants}`);
  console.log(
    `Average Variants per Canonical: ${stats.averageVariantsPerCanonical}`
  );
}

// Example 4: Clean entire recipe (includes automatic canonicalization)
async function example4_cleanRecipeWithSynonyms() {
  console.log(
    "\n=== Example 4: Clean Recipe with Automatic Canonicalization ===\n"
  );

  const recipe = {
    name: "Pasta Carbonara",
    ingredients: {
      dish: [
        { name: "extra virgin olive oil", quantity: 2, unit: "tbsp" },
        { name: "black pepper", quantity: 1, unit: "tsp" },
        { name: "sea salt", quantity: 0.5, unit: "tsp" },
        { name: "minced beef", quantity: 1, unit: "lb" },
        { name: "yellow onion", quantity: 1, unit: "whole" },
        { name: "fresh basil", quantity: 0.25, unit: "cup" },
      ],
    },
    instructions: [
      "Cook pasta according to package directions",
      "Brown the beef with onions",
      "Combine and season with herbs and spices",
    ],
  };

  console.log("Original Recipe:");
  console.log(JSON.stringify(recipe, null, 2));

  const response = await fetch(`${SERVICE_URL}/clean-recipe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recipe),
  });

  const cleaned = await response.json();

  console.log("\nCleaned Recipe (notice canonicalized ingredient names):");
  console.log(JSON.stringify(cleaned, null, 2));

  console.log("\nIngredient Transformations:");
  recipe.ingredients.dish.forEach((orig, i) => {
    const clean = cleaned.ingredients.dish[i];
    if (orig.name !== clean.name) {
      console.log(`  "${orig.name}" → "${clean.name}"`);
    }
  });
}

// Example 5: Integration with server's clean-recipes endpoint
async function example5_serverIntegration() {
  console.log("\n=== Example 5: Server Integration Example ===\n");

  console.log("The main SousChef server uses this service via:");
  console.log("  POST /api/clean-recipes");
  console.log("\nThis endpoint:");
  console.log("  1. Fetches all recipes from the database");
  console.log("  2. Sends each to the clean-recipe-service");
  console.log("  3. Returns the canonicalized recipes");
  console.log("\nThe clean-recipe-service client handles:");
  console.log("  - IAM authentication for Cloud Run");
  console.log("  - Circuit breaker pattern");
  console.log("  - Fallback to local cleaning");
  console.log("  - Automatic retry with exponential backoff");
}

// Run all examples
async function runAllExamples() {
  try {
    console.log("🚀 Clean Recipe Service - Synonym Canonicalization Examples");
    console.log(`Service URL: ${SERVICE_URL}\n`);

    await example1_canonicalizeSingleIngredient();
    await example2_batchCanonicalization();
    await example3_getSynonymStats();
    await example4_cleanRecipeWithSynonyms();
    await example5_serverIntegration();

    console.log("\n✅ All examples completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Error running examples:", error.message);
    console.error("\nMake sure the clean-recipe-service is running:");
    console.error("  cd clean-recipe-service");
    console.error("  npm run dev\n");
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}

module.exports = {
  example1_canonicalizeSingleIngredient,
  example2_batchCanonicalization,
  example3_getSynonymStats,
  example4_cleanRecipeWithSynonyms,
  example5_serverIntegration,
};
