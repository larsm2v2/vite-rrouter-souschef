# Clean Recipe Service

A microservice for normalizing and cleaning recipe data, including ingredient synonym canonicalization.

## Features

- **Recipe Normalization**: Standardizes recipe structure (fields, formats, types)
- **Ingredient Canonicalization**: Maps ingredient variations to canonical forms
- **RESTful API**: Simple HTTP endpoints for cleaning and canonicalization

## Endpoints

### POST `/clean-recipe`

Cleans and normalizes a recipe object.

**Request Body:**

```json
{
  "name": "Pasta Carbonara",
  "ingredients": {
    "dish": [
      { "name": "extra virgin olive oil", "quantity": 2, "unit": "tbsp" },
      { "name": "black pepper", "quantity": 1, "unit": "tsp" },
      { "name": "sea salt", "quantity": 0.5, "unit": "tsp" }
    ]
  },
  "instructions": ["Step 1", "Step 2"]
}
```

**Response:**

```json
{
  "uniqueId": 1732742400000,
  "slug": "pasta-carbonara",
  "name": "Pasta Carbonara",
  "ingredients": {
    "dish": [
      { "name": "olive oil", "quantity": 2, "unit": "tbsp" },
      { "name": "pepper", "quantity": 1, "unit": "tsp" },
      { "name": "salt", "quantity": 0.5, "unit": "tsp" }
    ]
  },
  "instructions": [
    { "text": "Step 1", "stepNumber": 1 },
    { "text": "Step 2", "stepNumber": 2 }
  ],
  "dietaryRestrictions": [],
  "servingInfo": {
    "prepTime": "",
    "cookTime": "",
    "totalTime": "",
    "servings": 0
  },
  "notes": [],
  "nutrition": {}
}
```

### POST `/canonicalize`

Canonicalizes a single ingredient name.

**Request Body:**

```json
{
  "ingredient": "black pepper"
}
```

**Response:**

```json
{
  "input": "black pepper",
  "canonical": "pepper",
  "hasVariants": true,
  "variants": [
    "black pepper",
    "ground pepper",
    "cracked pepper",
    "peppercorns",
    "whole pepper"
  ],
  "wasTransformed": true
}
```

### POST `/canonicalize-batch`

Canonicalizes multiple ingredients at once.

**Request Body:**

```json
{
  "ingredients": ["black pepper", "sea salt", "evoo", "unknown ingredient"]
}
```

**Response:**

```json
{
  "results": [
    { "input": "black pepper", "canonical": "pepper" },
    { "input": "sea salt", "canonical": "salt" },
    { "input": "evoo", "canonical": "olive oil" },
    { "input": "unknown ingredient", "canonical": "unknown ingredient" }
  ]
}
```

### GET `/synonym-stats`

Returns statistics about the synonym map.

**Response:**

```json
{
  "canonicalCount": 75,
  "totalVariants": 350,
  "averageVariantsPerCanonical": 4.7
}
```

## Synonym Map

The service maintains a comprehensive synonym map covering:

- **Seasonings & Spices**: salt, pepper, garlic powder, cumin, etc.
- **Oils & Fats**: olive oil, vegetable oil, butter, coconut oil
- **Dairy**: milk, cream, cheese varieties
- **Proteins**: chicken, beef, seafood
- **Vegetables**: onions, peppers, tomatoes, greens
- **Herbs**: basil, parsley, cilantro, thyme
- **Pantry Staples**: flour, sugar, rice, pasta
- **Condiments**: ketchup, mustard, soy sauce
- **Liquids**: broths, stocks
- **Baking Supplies**: baking powder, vanilla extract

### Adding New Synonyms

Edit `src/synonyms.ts` and add to the `INGREDIENT_SYNONYMS` object:

```typescript
const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  // ... existing entries
  "new canonical name": ["variant 1", "variant 2", "variant 3"],
};
```

The reverse lookup map is built automatically on module load.

## Running Locally

### Quick Start (Development)

```powershell
npm install
npx ts-node src/index.ts
```

Service runs on port 6000 by default.

### Build and Run

```powershell
npm install
npm run build
npm start
```

### Run Tests

```powershell
npm test
```

## Environment Variables

- `PORT`: Server port (default: 6000)

## Integration with Main Server

The main SousChef server can call this service for recipe cleaning:

```typescript
// In server environment
const CLEAN_RECIPE_SERVICE_URL =
  process.env.CLEAN_RECIPE_SERVICE_URL || "http://localhost:6000";

async function cleanRecipe(recipe: any) {
  const response = await fetch(`${CLEAN_RECIPE_SERVICE_URL}/clean-recipe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recipe),
  });
  return response.json();
}
```

## Docker Deployment

Build and deploy to Cloud Run:

```powershell
gcloud builds submit --config cloudbuild.yaml
```

## Architecture

```
clean-recipe-service/
├── src/
│   ├── index.ts           # Express server setup
│   ├── routes.ts          # API endpoints
│   ├── cleanRecipe.ts     # Recipe normalization logic
│   ├── synonyms.ts        # Ingredient canonicalization
│   └── synonyms.test.ts   # Unit tests
├── Dockerfile             # Container configuration
├── cloudbuild.yaml        # Cloud Build configuration
├── package.json
└── tsconfig.json
```

## Benefits

1. **Consistency**: All ingredient names are standardized
2. **Flexibility**: Accept various input formats
3. **Maintainability**: Single source of truth for synonyms
4. **Extensibility**: Easy to add new synonyms
5. **Performance**: In-memory lookup, no database queries
6. **Type Safety**: Full TypeScript support

## Examples

### Before Cleaning

```json
{
  "name": "Simple Salad",
  "ingredients": {
    "dish": [
      { "name": "extra virgin olive oil", "quantity": "2" },
      { "name": "BLACK PEPPER", "quantity": "1" },
      { "name": "  sea salt  ", "quantity": "0.5" }
    ]
  }
}
```

### After Cleaning

```json
{
  "name": "Simple Salad",
  "slug": "simple-salad",
  "uniqueId": 1732742400000,
  "ingredients": {
    "dish": [
      { "name": "olive oil", "quantity": 2 },
      { "name": "pepper", "quantity": 1 },
      { "name": "salt", "quantity": 0.5 }
    ]
  },
  "dietaryRestrictions": [],
  "servingInfo": {
    "prepTime": "",
    "cookTime": "",
    "totalTime": "",
    "servings": 0
  },
  "instructions": [],
  "notes": [],
  "nutrition": {}
}
```

## Future Enhancements

- [ ] Add unit conversions (tsp → ml, cups → g)
- [ ] Add nutrition data lookup
- [ ] Add allergen detection
- [ ] Support for multi-language ingredient names
- [ ] Machine learning for automatic synonym detection
