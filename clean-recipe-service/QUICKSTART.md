# Quick Start Guide - Ingredient Synonym System

## 🚀 5-Minute Setup

### 1. Install Dependencies

```powershell
cd clean-recipe-service
npm install
```

### 2. Start the Service

```powershell
npm run dev
```

Service starts on port 6000. You'll see:

```
Clean Recipe Service running on port 6000
```

### 3. Test It Out

**Option A: Run the examples**

```powershell
# In a new terminal
node examples.js
```

**Option B: Try the API directly**

Canonicalize a single ingredient:

```powershell
curl -X POST http://localhost:6000/canonicalize `
  -H "Content-Type: application/json" `
  -d '{"ingredient":"black pepper"}'
```

Clean a recipe (automatic canonicalization):

```powershell
curl -X POST http://localhost:6000/clean-recipe `
  -H "Content-Type: application/json" `
  -d '{
    "name": "Test Recipe",
    "ingredients": {
      "dish": [
        {"name": "extra virgin olive oil", "quantity": 2, "unit": "tbsp"},
        {"name": "sea salt", "quantity": 1, "unit": "tsp"}
      ]
    }
  }'
```

Get statistics:

```powershell
curl http://localhost:6000/synonym-stats
```

## 🧪 Run Tests

```powershell
npm test
```

## 📝 Adding New Synonyms

Edit `src/synonyms.ts`:

```typescript
const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  // ... existing entries
  ginger: ["fresh ginger", "ginger root", "ground ginger"],
};
```

Save the file. The reverse lookup map rebuilds automatically on restart.

## 🌐 Deploy to Cloud Run

```powershell
gcloud builds submit --config cloudbuild.yaml
```

## 📚 Documentation

- **Full docs**: `README.md`
- **Implementation details**: `SYNONYM_IMPLEMENTATION.md`
- **Examples**: `examples.js`
- **Tests**: `src/synonyms.test.ts`

## 🔗 Integration

The main SousChef server already integrates via:

- `server/src/05_frameworks/cleanRecipe/client.ts`

Set environment variable to use the service:

```powershell
$env:CLEAN_RECIPE_SERVICE_URL = "http://localhost:6000"
```

## ✅ What You Get

- ✅ 75 canonical ingredients
- ✅ 350+ variants automatically mapped
- ✅ Case-insensitive matching
- ✅ Whitespace handling
- ✅ 3 API endpoints
- ✅ Automatic integration with recipe cleaning
- ✅ TypeScript type safety
- ✅ Comprehensive tests

## 🎯 Common Use Cases

**Use Case 1: Clean all recipes**

```javascript
const recipes = await fetchRecipesFromDB();
const cleaned = await Promise.all(
  recipes.map((r) =>
    fetch("http://localhost:6000/clean-recipe", {
      method: "POST",
      body: JSON.stringify(r),
    }).then((res) => res.json())
  )
);
```

**Use Case 2: Batch canonicalize ingredients**

```javascript
const ingredients = ["black pepper", "evoo", "kosher salt"];
const result = await fetch("http://localhost:6000/canonicalize-batch", {
  method: "POST",
  body: JSON.stringify({ ingredients }),
}).then((res) => res.json());
```

**Use Case 3: Check if ingredient has synonyms**

```javascript
const result = await fetch("http://localhost:6000/canonicalize", {
  method: "POST",
  body: JSON.stringify({ ingredient: "black pepper" }),
}).then((res) => res.json());

console.log(result.hasVariants); // true
console.log(result.variants); // ["black pepper", "ground pepper", ...]
```

## 🐛 Troubleshooting

**Port 6000 already in use?**

```powershell
$env:PORT = "7000"
npm run dev
```

**Service not responding?**
Check the service is running:

```powershell
curl http://localhost:6000/synonym-stats
```

**Need to rebuild?**

```powershell
npm run build
npm start
```

## 🎉 That's It!

You now have a fully functional ingredient synonym canonicalization system integrated into your recipe cleaning pipeline.

Happy cooking! 👨‍🍳
