import { normalizeName } from "./groceryMerge";

export const AISLES = [
  "Produce",
  "Meat & seafood",
  "Dairy & eggs",
  "Bakery",
  "Pantry",
  "Canned & jarred",
  "Spices",
  "Frozen",
  "Beverages",
  "Other",
] as const;

export type Aisle = (typeof AISLES)[number];

const words = (list: string) => new RegExp(`\\b(?:${list})(?:e?s)?\\b`, "i");

/** Evaluated in order; the first match wins. Specific multi-word names come before general ones. */
const RULES: [Aisle, RegExp][] = [
  [
    "Produce",
    /\b(?:bell|chili|chile|hot|green|red|yellow|poblano|serrano)\s+peppers?\b|jalape/i,
  ],
  ["Frozen", words("ice cream|frozen|popsicle|sorbet")],
  [
    "Spices",
    words(
      "salt|black pepper|white pepper|pepper|peppercorn|pepper flake|paprika|cumin|cinnamon|nutmeg|oregano|turmeric|cayenne|curry powder|chili powder|garlic powder|onion powder|vanilla|allspice|coriander|cardamom|garam masala|bay leaf|bay leave|seasoning|saffron|za'atar|sumac|dried thyme|dried basil|dried oregano",
    ),
  ],
  [
    "Canned & jarred",
    words(
      "canned|can of|tomato paste|tomato sauce|passata|broth|stock|bouillon|coconut milk|coconut cream|peanut butter|almond butter|nut butter|olive|pickle|caper|salsa|jam|jelly|tuna|sardine|anchov|chickpea|black bean|kidney bean|pinto bean|cannellini",
    ),
  ],
  [
    "Beverages",
    words(
      "juice|wine|beer|coffee|tea|soda|sparkling water|kombucha|whiskey|vodka|rum",
    ),
  ],
  [
    "Dairy & eggs",
    words(
      "milk|butter|cheese|yogurt|yoghurt|cream|sour cream|egg|parmesan|mozzarella|cheddar|feta|ricotta|mascarpone|half and half|ghee|kefir",
    ),
  ],
  [
    "Meat & seafood",
    words(
      "chicken|beef|pork|turkey|bacon|sausage|ham|lamb|steak|ribs|meatball|ground meat|salmon|shrimp|prawn|cod|fish|crab|lobster|scallop|mussel|clam|tilapia|duck",
    ),
  ],
  [
    "Bakery",
    words(
      "bread|bun|roll|tortilla|bagel|pita|baguette|croissant|naan|sourdough|wrap|flatbread",
    ),
  ],
  [
    "Pantry",
    words(
      "flour|sugar|rice|pasta|noodle|spaghetti|macaroni|oil|vinegar|honey|syrup|oat|cereal|almond|walnut|pecan|peanut|cashew|pistachio|lentil|quinoa|couscous|soy sauce|mustard|ketchup|mayonnaise|mayo|baking powder|baking soda|yeast|chocolate|cocoa|breadcrumb|panko|tahini|cornstarch|raisin|dried|bean|seed|cracker|chip",
    ),
  ],
  [
    "Produce",
    words(
      "apple|banana|lemon|lime|orange|berry|strawberry|blueberry|raspberry|grape|avocado|tomato|potato|onion|garlic|shallot|carrot|celery|lettuce|spinach|kale|cabbage|broccoli|cauliflower|cucumber|zucchini|squash|mushroom|ginger|basil|parsley|cilantro|mint|thyme|rosemary|dill|chive|scallion|leek|corn|pea|eggplant|beet|radish|pear|peach|plum|mango|pineapple|melon|cherry|fruit|vegetable|salad|arugula|asparagus|pumpkin|turnip|parsnip|fennel|herb|sprout|greens|coriander leaves|lettuce",
    ),
  ],
];

export function aisleFor(name: string): Aisle {
  const text = normalizeName(name) + " " + name.toLowerCase();
  for (const [aisle, pattern] of RULES) {
    if (pattern.test(text)) return aisle;
  }
  return "Other";
}

export function isAisle(value: unknown): value is Aisle {
  return (
    typeof value === "string" && (AISLES as readonly string[]).includes(value)
  );
}
