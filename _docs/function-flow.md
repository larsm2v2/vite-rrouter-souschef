# Function Flow Diagram

**Date:** November 10, 2025  
**Project:** SousChef Recipe Application

This document maps the function flow through the Clean Architecture layers with file locations.

---

## Authentication Flow

### Google OAuth Login

```
1. User clicks "Login with Google"
   ↓
2. GET /auth/google
   → passport.authenticate() (05_frameworks/auth/passport.ts)
   ↓
3. Redirect to Google OAuth
   ↓
4. GET /auth/google/callback
   → passport.authenticate() (05_frameworks/auth/passport.ts)
   → GoogleStrategy.verify() (05_frameworks/auth/passport.ts)
   ↓
5. Find or create user in database
   → UserRepository.findByGoogleSub() (03_adapters/repositories/UserRepository.ts)
   → UserRepository.create() (03_adapters/repositories/UserRepository.ts)
   ↓
6. Serialize user session
   → passport.serializeUser() (05_frameworks/auth/passport.ts)
   ↓
7. Redirect to client application
```

### Check Authentication Status

```
1. GET /auth/check
   ↓
2. createCheckAuthentication() (04_factories/CheckAuthenticationFactory.ts)
   → new CheckAuthentication() (02_use_cases/CheckAuthentication.ts)
   ↓
3. CheckAuthentication.execute(req.user) (02_use_cases/CheckAuthentication.ts)
   ↓
4. Return authentication status
```

### Logout

```
1. POST /auth/logout
   ↓
2. createLogoutUser() (04_factories/LogoutUserFactory.ts)
   → new LogoutUser() (02_use_cases/LogoutUser.ts)
   ↓
3. LogoutUser.execute(req) (02_use_cases/LogoutUser.ts)
   → req.logout() (passport)
   → req.session.destroy() (express-session)
   ↓
4. Clear session cookie
   → res.clearCookie('connect.sid')
```

---

## User Profile Flow

### Get User Profile

```
1. GET /profile
   ↓
2. Authentication middleware check
   → req.user exists?
   ↓
3. createGetUserProfile() (04_factories/GetUserProfileFactory.ts)
   → new UserRepository() (03_adapters/repositories/UserRepository.ts)
   → new GetUserProfile(userRepository) (02_use_cases/GetUserProfile.ts)
   ↓
4. GetUserProfile.execute(userId) (02_use_cases/GetUserProfile.ts)
   → UserRepository.findById(userId) (03_adapters/repositories/UserRepository.ts)
   → pool.query() (05_frameworks/database/connection.ts)
   ↓
5. Return user profile data
```

---

## Recipe Management Flow

### Create Recipe

```
1. POST /recipes
   ↓
2. Clean recipe data (if using local service)
   → cleanRecipe(recipeData) (utils/cleanRecipe.ts OR clean-recipe-service)
   ↓
3. createCreateRecipe() (04_factories/CreateRecipeFactory.ts)
   → new RecipeRepository() (03_adapters/repositories/RecipeRepository.ts)
   → new CreateRecipe(recipeRepository) (02_use_cases/CreateRecipe.ts)
   ↓
4. CreateRecipe.execute(recipeData) (02_use_cases/CreateRecipe.ts)
   → RecipeRepository.create(recipe) (03_adapters/repositories/RecipeRepository.ts)
   → pool.query() (05_frameworks/database/connection.ts)
   ↓
5. Return created recipe
```

### Update Recipe

```
1. PUT /recipes/:id
   ↓
2. Clean recipe data
   → cleanRecipe(recipeData) (utils/cleanRecipe.ts OR clean-recipe-service)
   ↓
3. createUpdateRecipe() (04_factories/UpdateRecipeFactory.ts)
   → new RecipeRepository() (03_adapters/repositories/RecipeRepository.ts)
   → new UpdateRecipe(recipeRepository) (02_use_cases/UpdateRecipe.ts)
   ↓
4. UpdateRecipe.execute(recipeId, recipeData) (02_use_cases/UpdateRecipe.ts)
   → RecipeRepository.update(recipeId, recipe) (03_adapters/repositories/RecipeRepository.ts)
   → pool.query() (05_frameworks/database/connection.ts)
   ↓
5. Return updated recipe
```

### Delete Recipe

```
1. DELETE /recipes/:id
   ↓
2. createDeleteRecipe() (04_factories/DeleteRecipeFactory.ts)
   → new RecipeRepository() (03_adapters/repositories/RecipeRepository.ts)
   → new DeleteRecipe(recipeRepository) (02_use_cases/DeleteRecipe.ts)
   ↓
3. DeleteRecipe.execute(recipeId) (02_use_cases/DeleteRecipe.ts)
   → RecipeRepository.delete(recipeId) (03_adapters/repositories/RecipeRepository.ts)
   → pool.query() (05_frameworks/database/connection.ts)
   ↓
4. Return success/failure status
```

---

## Grocery List Flow

### Get Grocery List

```
1. GET /grocery
   ↓
2. Authentication middleware check
   → req.user exists?
   ↓
3. createGetGroceryList() (04_factories/GetGroceryListFactory.ts)
   → new GroceryRepository() (03_adapters/repositories/GroceryRepository.ts)
   → new GetGroceryList(groceryRepository) (02_use_cases/GetGroceryList.ts)
   ↓
4. GetGroceryList.execute(userId) (02_use_cases/GetGroceryList.ts)
   → GroceryRepository.findByUserId(userId) (03_adapters/repositories/GroceryRepository.ts)
   → pool.query() (05_frameworks/database/connection.ts)
   ↓
5. Return grocery list items
```

### Add Grocery Item

```
1. POST /grocery
   ↓
2. Validate input data
   ↓
3. GroceryRepository.create(groceryItem) (03_adapters/repositories/GroceryRepository.ts)
   → pool.query() (05_frameworks/database/connection.ts)
   ↓
4. Return created grocery item
```

### Update Grocery Item

```
1. PUT /grocery/:id
   ↓
2. Validate input data
   ↓
3. GroceryRepository.update(id, groceryItem) (03_adapters/repositories/GroceryRepository.ts)
   → pool.query() (05_frameworks/database/connection.ts)
   ↓
4. Return updated grocery item
```

### Delete Grocery Item

```
1. DELETE /grocery/:id
   ↓
2. GroceryRepository.delete(id) (03_adapters/repositories/GroceryRepository.ts)
   → pool.query() (05_frameworks/database/connection.ts)
   ↓
3. Return success/failure status
```

---

## Audit Logging Flow

### Automatic Request Logging

```
1. Any HTTP request
   ↓
2. Audit logging middleware (app.ts)
   → createLogAudit() (04_factories/LogAuditFactory.ts)
   → new LogAudit() (02_use_cases/AuditLogging.ts)
   ↓
3. res.on('finish') event fires
   ↓
4. LogAudit.execute(auditData) (02_use_cases/AuditLogging.ts)
   → pool.query() (05_frameworks/database/connection.ts)
   → INSERT INTO audit_log
   ↓
5. Log request details (user, action, endpoint, IP, status code, metadata)
```

---

## Application Initialization Flow

### Server Startup

```
1. Start application
   → main.ts (06_app/main.ts)
   ↓
2. validateEnvironment() (06_app/environment.ts)
   → Check required env variables
   → Throw error if missing
   ↓
3. startServer() (06_app/server.ts)
   → ensureDatabaseInitialized() (06_app/database.ts)
     → pool.query("SELECT 1 FROM users LIMIT 1") (05_frameworks/database/connection.ts)
     → If fails: initializeDatabase() (config/schema.ts)
       → createTables() (config/schema.ts)
       → migrateRecipeTables() (migrations/create_recipe_tables.ts)
   ↓
4. app.listen(PORT) (05_frameworks/myexpress/app.ts)
   → Server running on port 8000
```

### Database Connection

```
1. Application imports pool
   → import pool from '05_frameworks/database/connection.ts'
   ↓
2. createPool() (05_frameworks/database/connection.ts)
   → ensureDatabaseExists() (05_frameworks/database/connection.ts)
     → Connect to postgres database
     → Check if target database exists
     → Create database if needed
   ↓
3. new Pool(pgConfig) (05_frameworks/database/connection.ts)
   → Test connection
   → Return pool instance
```

---

## Middleware Flow

### Rate Limiting

```
1. HTTP request
   ↓
2. authRateLimiter (middleware/rateLimit.ts OR 05_frameworks/myexpress/middleware.ts)
   → Check request count
   → Block if limit exceeded
   → Allow if within limits
   ↓
3. Continue to route handler
```

### Session Management

```
1. HTTP request
   ↓
2. session middleware (05_frameworks/auth/sessions.ts)
   → Load session from store
   → Attach session to req.session
   ↓
3. passport.initialize() (05_frameworks/auth/passport.ts)
   → Initialize Passport
   ↓
4. passport.session() (05_frameworks/auth/passport.ts)
   → Deserialize user from session
   → Attach user to req.user
   ↓
5. Continue to route handler
```

### Error Handling

```
1. Error thrown in route handler
   ↓
2. errorHandlingMiddleware (05_frameworks/myexpress/middleware.ts)
   → Log error
   → Return 500 Internal Server Error
   → Include stack trace in development mode
```

---

## Utility Functions

### Encryption/Decryption

```
encryptToken(token) (utils/crypto.ts)
  → crypto.randomBytes() - Generate IV
  → crypto.createCipheriv() - Create cipher
  → cipher.update() + cipher.final() - Encrypt
  → Return encrypted:iv format

decryptToken(encryptedToken) (utils/crypto.ts)
  → Split encrypted and IV
  → crypto.createDecipheriv() - Create decipher
  → decipher.update() + decipher.final() - Decrypt
  → Return decrypted token
```

### Recipe Cleaning (if local)

```
cleanRecipe(recipe) (utils/cleanRecipe.ts OR clean-recipe-service)
  → Validate required fields
  → Generate slug from name
  → Normalize ingredients (ensure numeric quantities)
  → Normalize instructions (add step numbers)
  → Ensure arrays/objects exist
  → Return cleaned recipe
```

---

## Data Flow Summary

### Request → Response Flow

```
HTTP Request
  ↓
Middleware (rate limiting, sessions, auth)
  ↓
Route Handler (05_frameworks/myexpress/routes/)
  ↓
Factory (04_factories/)
  ↓
Controller (03_adapters/controllers/) [if applicable]
  ↓
Use Case (02_use_cases/)
  ↓
Repository (03_adapters/repositories/)
  ↓
Database (05_frameworks/database/connection.ts)
  ↓
Entity (01_entities/)
  ↓
Response sent back through layers
```

### Dependency Direction

```
06_app → 05_frameworks → 04_factories → 02_use_cases → 01_entities
                                       ↓
                              03_adapters (repositories, controllers)
                                       ↓
                                 01_entities
```
