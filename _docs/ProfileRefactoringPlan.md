Profile Refactoring Plan
Current State Analysis
Profile.tsx Issues:

Displays game/puzzle data (levels, stats, puzzles, saved maps)
Navigation goes to /game/:level, /saved-maps, /create-puzzle
Actions: Continue Game, New Game, Create Puzzle
Completely incompatible with recipe management app
Database Schema:

recipes table has user_id column (already exists for user-recipe association)
User entity has basic auth fields only
No user-specific recipe tracking (favorites, saved recipes, collections)
Existing Recipe Features:

Recipes can be generated and saved
RecipesPage shows all recipes
SousChefPage generates new recipes
Shopping list tracks selected recipes
Proposed Solution

Phase 1: Database Schema Updates
A. Extend recipes table
Add user interaction tracking to recipes:

- `is_favorite` BOOLEAN - Mark recipes as favorites
- `last_viewed_at` TIMESTAMP - Track when recipe was last opened
- `cooking_dates` JSONB - Array of dates when recipe was cooked (editable with warnings)
- `photo_url` TEXT - Optional recipe photo URL
- `share_token` TEXT - Unique token for sharing recipe with other users

B. Extend users table
Add user preferences and settings:

- `dietary_preferences` TEXT[] - Array of dietary preferences (vegetarian, vegan, gluten-free, etc.)
- `favorite_cuisines` TEXT[] - Preferred cuisines for recommendations

C. Create meal_plan table
Track scheduled meals for week/month planning:

```sql
CREATE TABLE meal_plan (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
  planned_date DATE NOT NULL,
  meal_type TEXT, -- breakfast, lunch, dinner, snack
  is_cooked BOOLEAN DEFAULT false,
  cooked_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_meal_plan_user_date ON meal_plan(user_id, planned_date DESC);
CREATE INDEX idx_meal_plan_recipe ON meal_plan(recipe_id);
```

D. Create shopping_list_versions table
Store shopping list with version history:

```sql
CREATE TABLE shopping_list_versions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  list_data JSONB NOT NULL, -- Complete shopping list snapshot
  created_at TIMESTAMP DEFAULT NOW(),
  is_current BOOLEAN DEFAULT true
);

CREATE INDEX idx_shopping_list_user_current ON shopping_list_versions(user_id, is_current);
CREATE INDEX idx_shopping_list_user_version ON shopping_list_versions(user_id, version DESC);
```

E. Create recipe_activity_log table
General logging for recipe interactions:

```sql
CREATE TABLE recipe_activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'viewed', 'generated', 'edited', 'deleted', 'shared'
  activity_data JSONB, -- Additional context (e.g., share token, edit details)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user ON recipe_activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_log_recipe ON recipe_activity_log(recipe_id, created_at DESC);
```

SQL Migration:

```sql
-- Update recipes table
ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cooking_dates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_recipes_user_favorite ON recipes(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_recipes_user_recent ON recipes(user_id, last_viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_share_token ON recipes(share_token);

-- Update users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS dietary_preferences TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS favorite_cuisines TEXT[] DEFAULT '{}';

-- Create meal_plan table (full SQL above)
-- Create shopping_list_versions table (full SQL above)
-- Create recipe_activity_log table (full SQL above)
```

Phase 2: Backend API Enhancements
New/Updated Endpoints:

1. **GET /api/profile** (update existing)

   - Add recipe statistics:
     - Total recipes saved/created by user
     - Favorite recipes count
     - Recent recipe activity count
     - Most cooked recipe (highest count in cooking_dates array)
     - Last cooked recipe and date
   - Include dietary preferences and favorite cuisines

2. **GET /api/recipes/user/:userId/favorites**

   - Return recipes where `user_id = :userId AND is_favorite = true`
   - Include photo_url if available
   - Limit to 10 recipes for profile display

3. **GET /api/recipes/user/:userId/recent**

   - Return recipes where `user_id = :userId` ordered by `last_viewed_at DESC` (limit 5)

4. **PATCH /api/recipes/:id/favorite**

   - Toggle `is_favorite` for a recipe
   - Log activity in recipe_activity_log

5. **PATCH /api/recipes/:id/view**

   - Update `last_viewed_at` timestamp when recipe is viewed
   - Log 'viewed' activity

6. **POST /api/recipes/:id/cooking-date**

   - Add a cooking date to `cooking_dates` array
   - Log 'cooked' activity

7. **PATCH /api/recipes/:id/cooking-date/:dateIndex**

   - Edit a cooking date (with warning confirmation)
   - Update `cooking_dates` array at specific index

8. **DELETE /api/recipes/:id/cooking-date/:dateIndex**

   - Remove a cooking date from array (with warning)

9. **GET /api/recipes/:id/share-token** (authenticated)

   - Generate or retrieve share_token for recipe
   - Log 'shared' activity

10. **POST /api/recipes/access-shared**

    - Accept share_token and recipe_id
    - Return recipe if token is valid
    - Optionally copy recipe to current user's collection

11. **GET /api/meal-plan/week** (new)

    - Return meal plan for current week
    - Query params: startDate (defaults to current week start)

12. **GET /api/meal-plan/month** (new)

    - Return meal plan for current month
    - Query params: year, month

13. **POST /api/meal-plan** (new)

    - Create meal plan entry
    - Body: { recipe_id, planned_date, meal_type }

14. **PATCH /api/meal-plan/:id/cook-today** (new)

    - Toggle is_cooked to true, set cooked_date to now
    - Add cooking_date to recipe.cooking_dates array

15. **DELETE /api/meal-plan/:id** (new)

    - Remove meal plan entry

16. **GET /api/shopping-list/current** (new)

    - Return current shopping list (is_current = true)

17. **GET /api/shopping-list/versions** (new)

    - Return shopping list version history

18. **POST /api/shopping-list** (new)

    - Create new shopping list version
    - Set previous version is_current = false
    - Body: { list_data }

19. **PATCH /api/user/preferences** (new)

    - Update dietary_preferences and favorite_cuisines
    - Body: { dietary_preferences?, favorite_cuisines? }

20. **GET /api/recipes/recommendations** (new)

    - Return personalized recipe recommendations based on:
      - User's dietary_preferences
      - User's favorite_cuisines
      - Most cooked recipes
      - Recently viewed recipes

21. **POST /api/recipes/parse-text** (new)

    - Parse recipe from pasted text using AI
    - Body: { text: string }
    - Returns structured RecipeModel JSON

22. **POST /api/recipes/parse-image** (new)
    - Extract recipe from uploaded image using OCR + AI
    - Body: FormData with image file
    - Uses Tesseract.js for OCR extraction
    - Returns structured RecipeModel JSON

Backend File Changes:

```
server/src/
├── 01_entities/
│   ├── Recipe.ts                      # Add isFavorite, lastViewedAt, cookingDates, photoUrl, shareToken
│   ├── User.ts                        # Add dietaryPreferences, favoriteCuisines
│   ├── MealPlan.ts                    # NEW: Meal plan entity
│   ├── ShoppingListVersion.ts         # NEW: Shopping list version entity
│   └── RecipeActivityLog.ts           # NEW: Activity log entity
├── 02_use_cases/
│   ├── GetUserProfile.ts              # Add recipe stats, most cooked, last cooked
│   ├── ToggleFavoriteRecipe.ts        # NEW: Toggle favorite status
│   ├── UpdateRecipeViewTime.ts        # NEW: Update last viewed
│   ├── AddCookingDate.ts              # NEW: Add cooking date to recipe
│   ├── EditCookingDate.ts             # NEW: Edit cooking date
│   ├── DeleteCookingDate.ts           # NEW: Remove cooking date
│   ├── GenerateShareToken.ts          # NEW: Generate share token for recipe
│   ├── AccessSharedRecipe.ts          # NEW: Access recipe via share token
│   ├── ParseRecipeFromText.ts         # NEW: Parse recipe from pasted text
│   ├── ParseRecipeFromImage.ts        # NEW: Extract recipe from image (OCR)
│   ├── GetMealPlan.ts                 # NEW: Fetch meal plan (week/month)
│   ├── CreateMealPlan.ts              # NEW: Add meal to plan
│   ├── UpdateMealPlanCooked.ts        # NEW: Mark meal as cooked
│   ├── DeleteMealPlan.ts              # NEW: Remove meal from plan
│   ├── GetShoppingList.ts             # NEW: Fetch current shopping list
│   ├── GetShoppingListVersions.ts     # NEW: Fetch version history
│   ├── CreateShoppingListVersion.ts   # NEW: Create new shopping list version
│   ├── UpdateUserPreferences.ts       # NEW: Update dietary/cuisine preferences
│   ├── GetRecipeRecommendations.ts    # NEW: Generate personalized recommendations
│   └── LogRecipeActivity.ts           # NEW: Log recipe interactions
├── 03_adapters/
│   ├── controllers/
│   │   ├── UserController.ts          # Update getProfile with new stats
│   │   ├── MealPlanController.ts      # NEW: Meal plan CRUD operations
│   │   ├── ShoppingListController.ts  # NEW: Shopping list version management
│   │   └── RecipeController.ts        # Add favorite, cooking date, share endpoints
│   └── repositories/
│       ├── RecipeRepository.ts        # Add favorite/recent/stats queries
│       ├── MealPlanRepository.ts      # NEW: Meal plan database operations
│       ├── ShoppingListRepository.ts  # NEW: Shopping list operations
│       ├── ActivityLogRepository.ts   # NEW: Activity logging operations
│       └── UserRepository.ts          # Add preferences update methods
└── 05_frameworks/myexpress/routes/
    ├── recipes.routes.ts              # Add all new recipe endpoints
    ├── mealPlan.routes.ts             # NEW: Meal plan routes
    ├── shoppingList.routes.ts         # NEW: Shopping list routes
    ├── recipeParser.routes.ts         # NEW: Text/image recipe parsing routes
    └── profile.ts                     # Update profile response with new data
```

Phase 3: Frontend Profile Redesign
New Profile Layout:

```
┌─────────────────────────────────────────┐
│  Profile Header                         │
│  ├─ Avatar (from OAuth)                 │
│  ├─ Display Name                        │
│  ├─ Email                               │
│  └─ Edit Preferences Button             │
├─────────────────────────────────────────┤
│  Recipe Statistics                      │
│  ├─ Total Recipes Saved: X             │
│  ├─ Favorite Recipes: Y                │
│  ├─ Most Cooked: [Recipe Name] (Z times)│
│  └─ Last Cooked: [Recipe Name] on [Date]│
├─────────────────────────────────────────┤
│  Quick Actions                          │
│  ├─ [Generate New Recipe] → SousChef   │
│  ├─ [Browse All Recipes] → Recipes     │
│  ├─ [View Shopping List] → Shopping    │
│  └─ [Meal Planner] → Week/Month View   │
├─────────────────────────────────────────┤
│  Favorite Recipes (2 rows x 5 cards)   │
│  ├─ Recipe Card 1 (with photo if exists)│
│  ├─ Recipe Card 2                      │
│  ├─ ... (up to 10 favorites)           │
│  └─ [View All Favorites]               │
├─────────────────────────────────────────┤
│  Personalized Recommendations          │
│  ├─ Based on dietary preferences       │
│  ├─ Based on favorite cuisines         │
│  └─ Based on cooking history           │
├─────────────────────────────────────────┤
│  Recent Recipes (list)                 │
│  ├─ Recipe Name 1 - viewed 2 days ago │
│  ├─ Recipe Name 2 - viewed 1 week ago │
│  └─ [View All Recipes]                 │
├─────────────────────────────────────────┤
│  Meal Planner Preview                  │
│  ├─ This Week's Meals (upcoming 3-5)   │
│  ├─ [Today] toggle for quick cooking   │
│  └─ [View Full Meal Planner]           │
├─────────────────────────────────────────┤
│  Cooking Frequency Calendar (optional) │
│  └─ Visual calendar showing cooking    │
      activity over time                 │
└─────────────────────────────────────────┘
```

Component Structure:

```tsx
Profile.tsx
├─ ProfileHeader (user info, edit preferences)
├─ RecipeStats (statistics cards: total, favorites, most cooked, last cooked)
├─ QuickActions (navigation buttons to SousChef, Recipes, Shopping, Meal Planner)
├─ FavoriteRecipes (2 rows x 5 recipe cards with optional photos)
├─ RecommendedRecipes (personalized recommendations based on preferences)
├─ RecentRecipes (list of recently viewed)
├─ MealPlannerPreview (upcoming meals this week)
└─ CookingFrequencyCalendar (optional: visual activity tracker)
```

Data Model:

```typescript
interface ProfileData {
  user: {
    id: number;
    email: string;
    displayName: string;
    avatar?: string;
    dietaryPreferences: string[];
    favoriteCuisines: string[];
  };
  stats: {
    totalRecipes: number;
    favoriteRecipes: number;
    mostCookedRecipe?: {
      id: number;
      name: string;
      cookCount: number;
    };
    lastCookedRecipe?: {
      id: number;
      name: string;
      cookedDate: string;
    };
  };
  favoriteRecipes: RecipeModel[]; // Max 10 for profile display
  recommendedRecipes: RecipeModel[]; // Personalized recommendations
  recentRecipes: RecipeModel[]; // Last 5 viewed
  upcomingMeals: MealPlan[]; // Next 3-5 planned meals
}

interface RecipeModel {
  id: number;
  name: string;
  cuisine?: string;
  mealType?: string;
  photoUrl?: string; // Display if exists, hide if null
  isFavorite: boolean;
  cookingDates: string[]; // Array of ISO date strings
  lastViewedAt?: string;
  shareToken?: string;
  // ... other recipe fields
}

interface MealPlan {
  id: number;
  recipeId: number;
  recipeName: string;
  plannedDate: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  isCooked: boolean;
  cookedDate?: string;
}
```

Phase 4: Navigation & Integration
Update Links:

Remove all game/puzzle routes (/game/:level, /saved-maps, /create-puzzle)
Add recipe-focused navigation:
"Generate Recipe" → /sous-chef
"Browse Recipes" → /recipes
"My Favorites" → /recipes?filter=favorites
"Shopping List" → /shopping-list (separate page with version history)
"Meal Planner" → /meal-planner (week/month calendar view)
Update App.tsx routing:
Add ShoppingListPage route
Add MealPlannerPage route
Remove any game-related routes
Update MainLayout.tsx:

Navbar items: Profile, SousChef, Recipes, Shopping List, Meal Planner
Active route highlighting
User avatar/name in navbar (link to profile)

Shopping List Page Design:
Modal vs. Separate Page Decision:

Recommendation: Separate Page (/shopping-list)
Reasons:
Version history requires more screen space
Better UX for managing complex shopping lists
Can be opened in separate tab/window for grocery shopping
Allows for future features (print, share, categories)
Modal Approach:
Would be lightweight and quick access
Good for simple "view current list" functionality
Limited space for version history (would need nested modals/drawers)
Could be useful as a "quick view" modal with "Open Full Page" button
Proposed Hybrid Approach:
Quick View Modal: Small floating button/icon to preview current shopping list
Full Page: Complete shopping list management with:
Current shopping list editor
Version history sidebar/panel
Restore previous version functionality
Export/print options
Add items manually or from recipes

### Implementation Steps

**Step 1: Database Migration**

1. Create migration file: `server/src/migrations/add_profile_features.ts`
2. Add columns to `recipes` table: `is_favorite`, `last_viewed_at`, `cooking_dates`, `photo_url`, `share_token`
3. Add columns to `users` table: `dietary_preferences`, `favorite_cuisines`
4. Create `meal_plan` table
5. Create `shopping_list_versions` table
6. Create `recipe_activity_log` table
7. Run migration and verify schema

**Step 2: Update Entities**

1. Update `Recipe` interface in `server/src/01_entities/Recipe.ts`:
   - Add `isFavorite`, `lastViewedAt`, `cookingDates`, `photoUrl`, `shareToken`
2. Update `User` interface in `server/src/01_entities/User.ts`:
   - Add `dietaryPreferences`, `favoriteCuisines`
3. Create `MealPlan` entity in `server/src/01_entities/MealPlan.ts`
4. Create `ShoppingListVersion` entity in `server/src/01_entities/ShoppingListVersion.ts`
5. Create `RecipeActivityLog` entity in `server/src/01_entities/RecipeActivityLog.ts`
6. Update entity schemas for TypeORM

**Step 3: Create Use Cases**

1. Recipe Use Cases:
   - `ToggleFavoriteRecipe.ts` - Toggle favorite status
   - `UpdateRecipeViewTime.ts` - Track recipe views
   - `AddCookingDate.ts` - Add cooking date to array
   - `EditCookingDate.ts` - Edit existing cooking date with warnings
   - `DeleteCookingDate.ts` - Remove cooking date with warnings
   - `GenerateShareToken.ts` - Generate unique share token
   - `AccessSharedRecipe.ts` - Access/copy recipe via share token
   - `ParseRecipeFromText.ts` - Parse pasted recipe text using AI
   - `ParseRecipeFromImage.ts` - Extract recipe from image using Tesseract OCR + AI
   - `GetRecipeRecommendations.ts` - Personalized recommendations
2. Meal Plan Use Cases:
   - `GetMealPlan.ts` - Fetch week/month meal plans
   - `CreateMealPlan.ts` - Add meal to schedule
   - `UpdateMealPlanCooked.ts` - Mark as cooked, update recipe cooking_dates
   - `DeleteMealPlan.ts` - Remove planned meal
3. Shopping List Use Cases:
   - `GetShoppingList.ts` - Fetch current shopping list
   - `GetShoppingListVersions.ts` - Fetch version history
   - `CreateShoppingListVersion.ts` - Create new version, archive old
4. User Use Cases:
   - Update `GetUserProfile.ts` to include:
     - Recipe stats (total, favorites, most cooked, last cooked)
     - Dietary preferences and favorite cuisines
   - `UpdateUserPreferences.ts` - Update dietary/cuisine preferences
5. Activity Logging:
   - `LogRecipeActivity.ts` - Log all recipe interactions

**Step 4: Update Repositories**

1. `RecipeRepository.ts`:
   - `findFavoritesByUser(userId, limit)` - Get favorite recipes
   - `findRecentByUser(userId, limit)` - Get recently viewed recipes
   - `findMostCookedByUser(userId)` - Get most frequently cooked recipe
   - `findLastCookedByUser(userId)` - Get last cooked recipe
   - `toggleFavorite(recipeId, userId)` - Toggle favorite status
   - `updateViewTime(recipeId)` - Update last_viewed_at
   - `addCookingDate(recipeId, date)` - Append to cooking_dates array
   - `editCookingDate(recipeId, index, newDate)` - Update specific index
   - `deleteCookingDate(recipeId, index)` - Remove from array
   - `generateShareToken(recipeId)` - Create unique token
   - `findByShareToken(token)` - Retrieve recipe by share token
2. `UserRepository.ts`:
   - `updatePreferences(userId, preferences)` - Update dietary/cuisine preferences
   - `getRecipeStats(userId)` - Calculate recipe statistics
3. Create `MealPlanRepository.ts`:
   - `findByUserAndDateRange(userId, startDate, endDate)` - Get meal plans
   - `create(mealPlan)` - Add meal to schedule
   - `markAsCooked(id)` - Update is_cooked and cooked_date
   - `delete(id)` - Remove meal plan
4. Create `ShoppingListRepository.ts`:
   - `findCurrentByUser(userId)` - Get current shopping list
   - `findVersionsByUser(userId)` - Get all versions
   - `createVersion(userId, listData)` - Create new version
   - `archiveCurrentVersion(userId)` - Set is_current = false
5. Create `ActivityLogRepository.ts`:
   - `log(userId, recipeId, activityType, activityData)` - Insert log entry
   - `findByUser(userId, limit)` - Get user activity history
   - `findByRecipe(recipeId, limit)` - Get recipe activity history

**Step 5: Update Controllers**

1. Update `UserController.ts`:
   - `getProfile()` - Include recipe stats, preferences, recommendations
2. Update `RecipeController.ts` (or recipes.routes.ts):
   - Add favorite toggle endpoint
   - Add cooking date management endpoints
   - Add share token endpoints
   - Add recommendations endpoint
3. Create `MealPlanController.ts`:
   - CRUD operations for meal planning
4. Create `ShoppingListController.ts`:
   - Version management operations

**Step 6: Create API Routes**

1. Update `recipes.routes.ts`:
   - PATCH `/api/recipes/:id/favorite` - Toggle favorite
   - PATCH `/api/recipes/:id/view` - Track view
   - POST `/api/recipes/:id/cooking-date` - Add cooking date
   - PATCH `/api/recipes/:id/cooking-date/:index` - Edit cooking date
   - DELETE `/api/recipes/:id/cooking-date/:index` - Delete cooking date
   - GET `/api/recipes/:id/share-token` - Get/generate share token
   - POST `/api/recipes/access-shared` - Access shared recipe
   - GET `/api/recipes/recommendations` - Get recommendations
   - GET `/api/recipes/user/:userId/favorites` - Get user favorites
   - GET `/api/recipes/user/:userId/recent` - Get recent recipes
2. Create `recipeParser.routes.ts`:
   - POST `/api/recipes/parse-text` - Parse recipe from pasted text
   - POST `/api/recipes/parse-image` - Extract recipe from uploaded image (OCR)
3. Create `mealPlan.routes.ts`:
   - GET `/api/meal-plan/week` - Get week schedule
   - GET `/api/meal-plan/month` - Get month schedule
   - POST `/api/meal-plan` - Add meal to schedule
   - PATCH `/api/meal-plan/:id/cook-today` - Mark as cooked
   - DELETE `/api/meal-plan/:id` - Remove meal
4. Create `shoppingList.routes.ts`:
   - GET `/api/shopping-list/current` - Get current list
   - GET `/api/shopping-list/versions` - Get version history
   - POST `/api/shopping-list` - Create new version
5. Update `profile.ts`:
   - PATCH `/api/user/preferences` - Update user preferences

**Step 7: Frontend API Client**

1. Create `client/src/api/profile.ts`:
   - `fetchProfileData()` - Get full profile with stats, favorites, recommendations
   - `updateUserPreferences(preferences)` - Update dietary/cuisine preferences
2. Create `client/src/api/recipes.ts`:
   - `toggleFavorite(recipeId)` - Toggle favorite status
   - `trackRecipeView(recipeId)` - Log recipe view
   - `addCookingDate(recipeId, date)` - Add cooking date
   - `editCookingDate(recipeId, index, newDate)` - Edit date
   - `deleteCookingDate(recipeId, index)` - Delete date
   - `generateShareToken(recipeId)` - Get share token
   - `accessSharedRecipe(token)` - Access shared recipe
   - `parseRecipeFromText(text)` - Parse pasted recipe text
   - `parseRecipeFromImage(imageFile)` - Extract recipe from image
   - `getRecommendations()` - Fetch personalized recipes
3. Create `client/src/api/mealPlan.ts`:
   - `getMealPlanWeek(startDate?)` - Fetch week schedule
   - `getMealPlanMonth(year, month)` - Fetch month schedule
   - `addMealToPlan(meal)` - Schedule meal
   - `markMealCooked(id)` - Toggle today button
   - `removeMealFromPlan(id)` - Delete meal
4. Create `client/src/api/shoppingList.ts`:
   - `getCurrentShoppingList()` - Get current list
   - `getShoppingListVersions()` - Get history
   - `createShoppingListVersion(listData)` - Save new version

**Step 8: UI Implementation - Profile Page**

1. Create new `Profile.tsx` structure:
   - Remove all game-related code
   - Create component sections:
     - `ProfileHeader` - User info, avatar, edit preferences button
     - `RecipeStats` - Statistics cards
     - `QuickActions` - Navigation buttons
     - `FavoriteRecipes` - 2x5 grid of recipe cards
     - `RecommendedRecipes` - Personalized suggestions
     - `RecentRecipes` - Recently viewed list
     - `MealPlannerPreview` - Upcoming meals
     - `CookingFrequencyCalendar` - Optional activity tracker
2. Fetch profile data on mount:
   - Call `fetchProfileData()` API
   - Populate state with user, stats, favorites, recommendations, recent, upcoming meals
3. Implement favorite display:
   - Grid layout: 2 rows x 5 columns
   - Recipe cards with photo (if photoUrl exists)
   - Click to view recipe details
   - Heart icon to toggle favorite
4. Implement quick actions:
   - Navigate to /sous-chef, /recipes, /shopping-list, /meal-planner
5. Style with existing CSS patterns

**Step 9: UI Implementation - Recipe Cards**

1. Update recipe card component to show:
   - Recipe photo if `photoUrl` exists (conditional rendering)
   - Recipe name, cuisine, meal type
   - Favorite heart icon (toggle functionality)
   - Click to view full recipe
2. Add photo upload/URL functionality:
   - Allow users to add photo URL when creating/editing recipe
   - Validate image URL before saving

**Step 10: UI Implementation - Meal Planner Page**

1. Create `MealPlannerPage.tsx`:
   - Week view (calendar grid for 7 days)
   - Month view (full calendar for month)
   - Toggle between week/month
   - Add meal button (opens modal to select recipe and meal type)
   - Today toggle button on each meal
   - Edit/delete meal buttons
2. Create `AddMealModal.tsx`:
   - Select recipe dropdown (user's recipes)
   - Select date picker
   - Select meal type (breakfast, lunch, dinner, snack)
   - Save button
3. Implement "Cook Today" toggle:
   - Marks meal as cooked
   - Adds date to recipe's cooking_dates array
   - Updates cooking statistics

**Step 11: UI Implementation - Shopping List Page**

1. Create `ShoppingListPage.tsx`:
   - Current shopping list editor (add/remove items)
   - Version history sidebar
   - Restore previous version button
   - Save new version button
   - Export/print functionality (future)
2. Create `ShoppingListVersionHistory.tsx`:
   - List of all versions with timestamps
   - Click to preview
   - Restore button with confirmation
3. Optional: Create quick view modal component:
   - Floating button for quick access
   - Preview current list
   - "Open Full Page" link

**Step 12: Update Preferences UI**

1. Create `PreferencesModal.tsx`:
   - Multi-select for dietary preferences (vegetarian, vegan, gluten-free, etc.)
   - Multi-select for favorite cuisines (Italian, Mexican, Asian, etc.)
   - Save button
   - Cancel button
2. Trigger modal from Profile page "Edit Preferences" button
3. Update user preferences via API on save

**Step 13: Implement Cooking Date Management**

1. In recipe detail view, add "Cooking History" section:
   - List all cooking dates (editable)
   - Add new cooking date button
   - Edit button (with warning modal)
   - Delete button (with confirmation modal)
2. Create warning modals:
   - "Editing this date will affect your cooking statistics. Continue?"
   - "Deleting this date cannot be undone. Continue?"

**Step 14: Implement Recipe Sharing**

1. Add "Share Recipe" button to recipe detail page
2. Generate share token when clicked
3. Copy shareable link to clipboard (e.g., `app.com/recipes/shared?token=xxx`)
4. Create `/recipes/shared` route to accept shared recipes
5. Display recipe to non-owner users
6. "Copy to My Recipes" button for non-owners

**Step 15: Testing**

1. Database tests:
   - Test all migrations
   - Verify indexes created
   - Test cascade deletes
2. Backend API tests:
   - Test all new endpoints
   - Test favorite toggle
   - Test cooking date CRUD
   - Test meal plan CRUD
   - Test shopping list versioning
   - Test activity logging
   - Test recommendations algorithm
   - Test share token generation/validation
   - Test recipe parsing from text
   - Test recipe parsing from image (OCR)
3. Frontend tests:
   - Test profile data loading
   - Test favorite display (10 max, 2 rows)
   - Test navigation to other pages
   - Test meal planner week/month views
   - Test shopping list version management
   - Test preferences update
   - Test cooking date warnings
   - Test recipe sharing flow
   - Test recipe paste/upload flow
4. Integration tests:
   - Test complete user flow: generate recipe → save → add to meal plan → cook today → view stats
   - Test shopping list creation from multiple recipes
   - Test recommendations based on user preferences
   - Test paste recipe → parse → save → redirect to profile
   - Test upload image → OCR → parse → save → redirect to profile
5. Manual testing:
   - Verify all game/puzzle references removed
   - Test photo display (show if exists, hide if null)
   - Test calendar frequency visualization
   - Test version history restore
   - Test share token flow with multiple users
   - Test OCR accuracy with various recipe image formats

**Step 16: Recipe Parser Implementation (Text & Image)**

1. **Install Dependencies:**
   ```bash
   # Client-side
   cd client
   npm install tesseract.js
   
   # Server-side (if doing OCR server-side)
   cd ../server
   npm install tesseract.js multer
   npm install --save-dev @types/multer
   ```

2. **Create AddRecipePage Component (`client/src/components/pages/AddRecipePage.tsx`):**
   - Tab interface: "Paste Text" vs "Upload Image"
   - **Paste Text Tab:**
     - Large textarea for pasting recipe
     - "Parse Recipe" button
     - Preview parsed recipe JSON
     - "Save Recipe" button
   - **Upload Image Tab:**
     - File input (accept images: .jpg, .png, .jpeg)
     - Image preview
     - "Extract Recipe" button (triggers OCR)
     - Loading indicator during OCR processing
     - Preview extracted text and parsed recipe
     - "Save Recipe" button
   - After save: Auto-redirect to `/profile`

3. **Backend OCR Service (`server/src/05_frameworks/ocr/tesseractService.ts`):**
   ```typescript
   import Tesseract from 'tesseract.js';
   
   export async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
     const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
       logger: (m) => console.log(m),
     });
     return text;
   }
   ```

4. **Backend Recipe Parser (`server/src/05_frameworks/ai/recipeParser.ts`):**
   ```typescript
   import { GoogleGenerativeAI } from '@google/generative-ai';
   
   export async function parseRecipeText(text: string, genAI: GoogleGenerativeAI) {
     const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
     
     // Use existing preprompt logic with ocrAddon
     const prompt = `This is an OCR addition. Convert this recipe text to JSON format...
     ${text}`;
     
     const result = await model.generateContent(prompt);
     const response = result.response.text();
     
     // Extract JSON from response
     const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
     if (jsonMatch && jsonMatch[1]) {
       return JSON.parse(jsonMatch[1].trim());
     }
     throw new Error('Failed to parse recipe');
   }
   ```

5. **Backend Routes (`server/src/05_frameworks/myexpress/routes/recipeParser.routes.ts`):**
   ```typescript
   import express from 'express';
   import multer from 'multer';
   import { extractTextFromImage } from '../../ocr/tesseractService';
   import { parseRecipeText } from '../../ai/recipeParser';
   import { authenticateJWT } from '../jwtAuth';
   
   const router = express.Router();
   const upload = multer({ storage: multer.memoryStorage() });
   
   // Parse recipe from pasted text
   router.post('/parse-text', authenticateJWT, async (req, res, next) => {
     try {
       const { text } = req.body;
       const parsedRecipe = await parseRecipeText(text, genAI);
       res.json(parsedRecipe);
     } catch (error) {
       next(error);
     }
   });
   
   // Parse recipe from uploaded image
   router.post('/parse-image', authenticateJWT, upload.single('image'), async (req, res, next) => {
     try {
       if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
       
       // Extract text from image
       const extractedText = await extractTextFromImage(req.file.buffer);
       
       // Parse recipe from extracted text
       const parsedRecipe = await parseRecipeText(extractedText, genAI);
       
       res.json({ extractedText, parsedRecipe });
     } catch (error) {
       next(error);
     }
   });
   
   export default router;
   ```

6. **Frontend AddRecipePage Implementation:**
   - Create tabbed interface (Paste vs Upload)
   - Handle text parsing with loading state
   - Handle image upload with OCR processing
   - Display parsed recipe preview
   - Save recipe and redirect to profile
   - Handle errors gracefully

7. **Update App.tsx Routing:**
   ```typescript
   <Route path="/add-recipe" element={<AddRecipePage />} />
   ```

8. **Add Quick Action to Profile:**
   - "Add Recipe" button → Navigate to `/add-recipe`
   - Include in Quick Actions section alongside "Generate Recipe", "Browse Recipes", etc.

9. **Existing OCR Integration (from SousChef):**
   - You already have `ocrAddon` state in `SousChef.tsx`
   - The `preprompt()` function in `Prompts.tsx` has OCR handling
   - Reuse this logic for the AddRecipePage component
   - Leverage existing AI parsing infrastructure

10. **Client-side OCR Alternative (if preferred):**
    - Can do OCR client-side with `tesseract.js` in browser
    - Reduces server load
    - Better user feedback during processing
    - Example:
    ```typescript
    import Tesseract from 'tesseract.js';
    
    const handleImageUpload = async (file: File) => {
      setLoading(true);
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      setExtractedText(text);
      
      // Send text to backend for AI parsing
      const parsedRecipe = await parseRecipeFromText(text);
      setLoading(false);
    };
    ```

---

## Clarifications & Decisions (Based on User Feedback)

### 1. Favorite Recipes Display

- **Format**: Simple list display at the top of favorites section
- **Quantity**: 10 favorite recipes maximum
- **Layout**: 2 rows x 5 columns grid
- **Photos**: Display recipe photo if `photoUrl` exists, hide if null

### 2. Recipe Statistics

**Required Stats:**

- Total recipes saved/created
- Favorite recipes count
- **Most cooked recipe** (recipe with highest count in `cooking_dates` array)
- **Last cooked recipe** with date

**Additional Features:**

- **Weekly meal schedule** - Plan meals for the week
- **Monthly meal schedule** - Plan meals for the month
- **Today toggle** - Easy button to mark meal as cooked today
- **Frequency calendar** - Visual display of cooking activity
  - Track array of all previous cooking dates
  - Dates are editable with warnings
  - Calendar visualization of cooking patterns

### 3. Activity Logging

- **Track all recipe interactions**: views, generations, edits, deletions, shares
- **General logging system** using `recipe_activity_log` table
- Store activity type and optional metadata in JSONB field

### 4. Shopping List

- **User-specific**: Each user has their own shopping list(s)
- **Version history**: Track all previous versions of shopping list
- **Storage**: `shopping_list_versions` table with JSONB data
- **Page type**: Separate page (`/shopping-list`)
  - Better for managing complex lists
  - More space for version history
  - Can be opened in separate tab for grocery shopping
  - Optional: Quick view modal for preview

### 5. Recipe Ownership & Sharing

- **Ownership**: Yes, all recipes owned by specific users (`user_id` in recipes table)
- **Public recipes**: No public recipe pool
- **Sharing mechanism**: Users can share recipes via:
  - Recipe ID + unique share token
  - Token links to owner's account
  - Recipient can view and optionally copy to their collection
- **Share token**: Generated per recipe, stored in `recipes.share_token` column

### 6. User Preferences

- **Dietary preferences**: Yes, add to `users` table as TEXT[] array
  - Examples: vegetarian, vegan, gluten-free, dairy-free, nut-free, etc.
- **Favorite cuisines**: Yes, add to `users` table as TEXT[] array
  - Examples: Italian, Mexican, Asian, Mediterranean, etc.
- **Personalized recommendations**: Yes, shown on Profile page
  - Based on dietary preferences
  - Based on favorite cuisines
  - Based on cooking history (most cooked recipes)
  - Based on recently viewed recipes

### 7. Photo/Avatar

- **User avatar**: Keep current OAuth avatar system
- **Recipe photos**:
  - Create potential for recipe photos (`photo_url` column in recipes)
  - Display photo on recipe cards if URL exists
  - **If no photo exists, do not show placeholder** - conditional rendering only

---

## Additional Considerations

### Recipe Cooking Date Management

- **Editable dates**: Users can edit previously logged cooking dates
- **Warning system**: Show confirmation warning when editing/deleting dates
  - "Editing this date will affect your cooking statistics. Continue?"
  - "Deleting this date cannot be undone. Continue?"
- **Statistics impact**: Editing/deleting dates updates:
  - Most cooked recipe calculation
  - Last cooked recipe
  - Cooking frequency calendar

### Meal Planner Features

- **Week view**: 7-day calendar grid showing planned meals
- **Month view**: Full month calendar
- **Meal types**: Breakfast, lunch, dinner, snack
- **Quick cooking**: "Cook Today" button to:
  - Mark meal as cooked
  - Add current date to recipe's `cooking_dates` array
  - Update cooking statistics automatically
- **Planning**: Drag-and-drop or modal-based meal assignment

### Shopping List Version Management

- **Automatic versioning**: Creating new list increments version number
- **Archive previous**: Setting `is_current = false` on old version
- **Restore functionality**: Can restore previous version as current
- **Version metadata**: Timestamp, version number, user ID

### Recommendations Algorithm

Personalized recipe recommendations based on:

1. **Dietary preferences** - Filter recipes matching user's dietary restrictions
2. **Favorite cuisines** - Prioritize recipes from preferred cuisines
3. **Cooking patterns** - Suggest recipes similar to most cooked
4. **Exploration** - Include some variety for discovery
5. **Recency** - Avoid over-suggesting recently viewed recipes

### Navigation Flow

```
Profile → Generate Recipe → SousChef Page → Save Recipe → Add to Meal Plan
                                                       ↓
Profile → Browse Recipes → Recipe Detail → Add to Favorites
                                        ↓
                                    Add to Meal Plan
                                        ↓
                                  Shopping List (from selected recipes)

Profile → Paste Recipe or Upload Image → Save Recipe → Auto Redirect to Profile
```

---

## Questions Answered

✅ **Favorite Recipes Display**: Simple list, 10 max, 2 rows x 5 columns  
✅ **Recipe Statistics**: Most cooked, last cooked, meal scheduler, frequency calendar  
✅ **Activity Logging**: Yes, general logging system  
✅ **Shopping List**: User-specific, version history, separate page  
✅ **Recipe Ownership**: All user-owned, sharing via recipe ID + token  
✅ **User Preferences**: Dietary preferences and favorite cuisines in users table  
✅ **Recommendations**: Yes, personalized based on preferences and history  
✅ **Photos**: OAuth avatar kept, recipe photos conditional (show if exists)
