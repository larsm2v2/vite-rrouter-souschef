/**
 * Ingredient Synonym Canonicalization Module
 *
 * Maps ingredient variations to canonical forms for consistent recipe data.
 * This allows flexible input while maintaining clean, standardized data.
 */

/**
 * Synonym map: canonical ingredient → array of variants
 */
const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  // Seasonings & Spices
  salt: [
    "sea salt",
    "table salt",
    "kosher salt",
    "fine salt",
    "coarse salt",
    "himalayan salt",
  ],
  pepper: [
    "black pepper",
    "ground pepper",
    "cracked pepper",
    "peppercorns",
    "whole pepper",
  ],
  "garlic powder": ["granulated garlic", "dried garlic powder"],
  "onion powder": ["dried onion powder", "granulated onion"],
  "red pepper flakes": [
    "crushed red pepper",
    "red chili flakes",
    "pepper flakes",
  ],
  "cayenne pepper": ["ground cayenne", "cayenne", "cayenne powder"],
  paprika: ["sweet paprika", "hungarian paprika"],
  cumin: ["ground cumin", "cumin powder"],
  coriander: ["ground coriander", "coriander powder"],
  cinnamon: ["ground cinnamon", "cinnamon powder"],

  // Oils & Fats
  "olive oil": ["extra virgin olive oil", "evoo", "light olive oil"],
  "vegetable oil": ["canola oil", "corn oil", "soybean oil"],
  butter: ["unsalted butter", "salted butter", "sweet cream butter"],
  "coconut oil": ["virgin coconut oil", "refined coconut oil"],

  // Dairy
  milk: ["whole milk", "2% milk", "skim milk", "low-fat milk"],
  "heavy cream": ["heavy whipping cream", "whipping cream"],
  "sour cream": ["soured cream", "cultured sour cream"],
  yogurt: ["plain yogurt", "greek yogurt", "natural yogurt"],
  "cream cheese": ["philadelphia cream cheese", "soft cream cheese"],
  parmesan: ["parmesan cheese", "parmigiano reggiano", "grated parmesan"],
  mozzarella: ["mozzarella cheese", "fresh mozzarella", "shredded mozzarella"],
  cheddar: ["cheddar cheese", "sharp cheddar", "mild cheddar"],

  // Proteins
  "chicken breast": [
    "boneless chicken breast",
    "skinless chicken breast",
    "chicken breast fillet",
  ],
  "ground beef": ["minced beef", "hamburger meat", "beef mince"],
  bacon: ["bacon strips", "streaky bacon", "smoked bacon"],
  eggs: ["large eggs", "whole eggs", "chicken eggs"],
  salmon: ["salmon fillet", "salmon steak", "atlantic salmon"],
  shrimp: ["prawns", "large shrimp", "jumbo shrimp"],

  // Vegetables
  onion: ["yellow onion", "white onion", "spanish onion"],
  garlic: ["garlic cloves", "fresh garlic"],
  tomato: ["fresh tomato", "ripe tomato", "vine tomato"],
  "bell pepper": [
    "sweet pepper",
    "capsicum",
    "red bell pepper",
    "green bell pepper",
  ],
  carrot: ["carrots", "fresh carrot"],
  celery: ["celery stalks", "celery ribs"],
  potato: ["potatoes", "russet potato", "white potato"],
  spinach: ["fresh spinach", "baby spinach", "spinach leaves"],
  kale: ["curly kale", "lacinato kale", "dinosaur kale"],

  // Herbs
  basil: ["fresh basil", "basil leaves", "sweet basil"],
  parsley: ["fresh parsley", "italian parsley", "flat-leaf parsley"],
  cilantro: ["fresh cilantro", "coriander leaves", "chinese parsley"],
  thyme: ["fresh thyme", "thyme leaves", "dried thyme"],
  rosemary: ["fresh rosemary", "rosemary sprigs", "dried rosemary"],
  oregano: ["dried oregano", "fresh oregano", "oregano leaves"],

  // Pantry Staples
  flour: ["all-purpose flour", "ap flour", "plain flour", "white flour"],
  sugar: ["granulated sugar", "white sugar", "caster sugar"],
  "brown sugar": [
    "light brown sugar",
    "dark brown sugar",
    "packed brown sugar",
  ],
  rice: ["white rice", "long-grain rice", "jasmine rice"],
  pasta: ["dried pasta", "italian pasta"],
  "soy sauce": ["light soy sauce", "dark soy sauce", "shoyu"],
  vinegar: ["white vinegar", "distilled vinegar"],
  "balsamic vinegar": ["aged balsamic", "balsamic vinegar of modena"],

  // Condiments & Sauces
  ketchup: ["tomato ketchup", "catsup"],
  mayonnaise: ["mayo", "real mayonnaise"],
  mustard: ["yellow mustard", "prepared mustard", "american mustard"],
  "dijon mustard": ["dijon", "french mustard"],
  "hot sauce": ["tabasco", "pepper sauce", "louisiana hot sauce"],

  // Liquids
  water: ["cold water", "warm water", "filtered water"],
  "chicken broth": ["chicken stock", "chicken bouillon"],
  "beef broth": ["beef stock", "beef bouillon"],
  "vegetable broth": ["vegetable stock", "veggie broth"],

  // Baking
  "baking powder": ["double-acting baking powder"],
  "baking soda": ["bicarbonate of soda", "sodium bicarbonate"],
  "vanilla extract": ["pure vanilla extract", "vanilla essence"],
  "cocoa powder": ["unsweetened cocoa powder", "dutch process cocoa"],
};

/**
 * Reverse lookup map: synonym → canonical ingredient
 * Built automatically from INGREDIENT_SYNONYMS
 */
const synonymToCanonical: Map<string, string> = new Map();

// Build reverse lookup
for (const [canonical, variants] of Object.entries(INGREDIENT_SYNONYMS)) {
  // The canonical form maps to itself
  synonymToCanonical.set(canonical.toLowerCase(), canonical);

  // Each variant maps to the canonical form
  for (const variant of variants) {
    synonymToCanonical.set(variant.toLowerCase(), canonical);
  }
}

/**
 * Canonicalize an ingredient name
 *
 * @param ingredientName - The ingredient name to canonicalize
 * @returns The canonical form if found, otherwise the original name
 *
 * @example
 * canonicalizeIngredient("black pepper") // returns "pepper"
 * canonicalizeIngredient("evoo") // returns "olive oil"
 * canonicalizeIngredient("unknown ingredient") // returns "unknown ingredient"
 */
export function canonicalizeIngredient(ingredientName: string): string {
  if (!ingredientName || typeof ingredientName !== "string") {
    return ingredientName;
  }

  const normalized = ingredientName.toLowerCase().trim();
  return synonymToCanonical.get(normalized) || ingredientName;
}

/**
 * Get all variants for a canonical ingredient
 *
 * @param canonical - The canonical ingredient name
 * @returns Array of variants, or empty array if not found
 */
export function getVariants(canonical: string): string[] {
  return INGREDIENT_SYNONYMS[canonical] || [];
}

/**
 * Check if an ingredient has known synonyms
 *
 * @param ingredientName - The ingredient name to check
 * @returns true if the ingredient or its canonical form has variants
 */
export function hasSynonyms(ingredientName: string): boolean {
  const canonical = canonicalizeIngredient(ingredientName);
  return canonical in INGREDIENT_SYNONYMS;
}

/**
 * Get statistics about the synonym map
 */
export function getSynonymStats(): {
  canonicalCount: number;
  totalVariants: number;
  averageVariantsPerCanonical: number;
} {
  const canonicalCount = Object.keys(INGREDIENT_SYNONYMS).length;
  const totalVariants = Object.values(INGREDIENT_SYNONYMS).reduce(
    (sum, variants) => sum + variants.length,
    0
  );

  return {
    canonicalCount,
    totalVariants,
    averageVariantsPerCanonical:
      Math.round((totalVariants / canonicalCount) * 10) / 10,
  };
}
