"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata"); // ensure reflect metadata is available
const tsyringe_1 = require("tsyringe");
// Repositories
const UserRepository_1 = require("../03_adapters/repositories/UserRepository");
const RecipeRepository_1 = require("../03_adapters/repositories/RecipeRepository");
const GroceryRepository_1 = require("../03_adapters/repositories/GroceryRepository");
const MealPlanRepository_1 = require("../03_adapters/repositories/MealPlanRepository");
const ShoppingListVersionRepository_1 = require("../03_adapters/repositories/ShoppingListVersionRepository");
const RecipeActivityLogRepository_1 = require("../03_adapters/repositories/RecipeActivityLogRepository");
// Use-cases
const GetUserProfile_1 = require("../02_use_cases/GetUserProfile");
const GetGroceryList_1 = require("../02_use_cases/GetGroceryList");
const GetMealPlan_1 = require("../02_use_cases/GetMealPlan");
const CreateMealPlan_1 = require("../02_use_cases/CreateMealPlan");
const GetShoppingListVersion_1 = require("../02_use_cases/GetShoppingListVersion");
const CreateShoppingListVersion_1 = require("../02_use_cases/CreateShoppingListVersion");
const LogRecipeActivity_1 = require("../02_use_cases/LogRecipeActivity");
const GetRecipeActivityLog_1 = require("../02_use_cases/GetRecipeActivityLog");
const CreateRecipe_1 = require("../02_use_cases/CreateRecipe");
const UpdateRecipe_1 = require("../02_use_cases/UpdateRecipe");
const DeleteRecipe_1 = require("../02_use_cases/DeleteRecipe");
const AuditLogging_1 = require("../02_use_cases/AuditLogging");
const CheckAuthentication_1 = require("../02_use_cases/CheckAuthentication");
const LogoutUser_1 = require("../02_use_cases/LogoutUser");
// Controllers
const UserController_1 = require("../03_adapters/controllers/UserController");
const GroceryController_1 = require("../03_adapters/controllers/GroceryController");
const MealPlanController_1 = require("../03_adapters/controllers/MealPlanController");
const ShoppingListController_1 = require("../03_adapters/controllers/ShoppingListController");
const RecipeActivityController_1 = require("../03_adapters/controllers/RecipeActivityController");
// Register repositories as singletons
tsyringe_1.container.registerSingleton(UserRepository_1.UserRepository, UserRepository_1.UserRepository);
tsyringe_1.container.registerSingleton(RecipeRepository_1.RecipeRepository, RecipeRepository_1.RecipeRepository);
tsyringe_1.container.registerSingleton(GroceryRepository_1.GroceryRepository, GroceryRepository_1.GroceryRepository);
tsyringe_1.container.registerSingleton(MealPlanRepository_1.MealPlanRepository, MealPlanRepository_1.MealPlanRepository);
tsyringe_1.container.registerSingleton(ShoppingListVersionRepository_1.ShoppingListVersionRepository, ShoppingListVersionRepository_1.ShoppingListVersionRepository);
tsyringe_1.container.registerSingleton(RecipeActivityLogRepository_1.RecipeActivityLogRepository, RecipeActivityLogRepository_1.RecipeActivityLogRepository);
// Register use-cases
tsyringe_1.container.registerSingleton(GetUserProfile_1.GetUserProfile, GetUserProfile_1.GetUserProfile);
tsyringe_1.container.registerSingleton(GetGroceryList_1.GetGroceryList, GetGroceryList_1.GetGroceryList);
tsyringe_1.container.registerSingleton(GetMealPlan_1.GetMealPlan, GetMealPlan_1.GetMealPlan);
tsyringe_1.container.registerSingleton(CreateMealPlan_1.CreateMealPlan, CreateMealPlan_1.CreateMealPlan);
tsyringe_1.container.registerSingleton(GetShoppingListVersion_1.GetShoppingListVersion, GetShoppingListVersion_1.GetShoppingListVersion);
tsyringe_1.container.registerSingleton(CreateShoppingListVersion_1.CreateShoppingListVersion, CreateShoppingListVersion_1.CreateShoppingListVersion);
tsyringe_1.container.registerSingleton(LogRecipeActivity_1.LogRecipeActivity, LogRecipeActivity_1.LogRecipeActivity);
tsyringe_1.container.registerSingleton(GetRecipeActivityLog_1.GetRecipeActivityLog, GetRecipeActivityLog_1.GetRecipeActivityLog);
// Additional use-cases
tsyringe_1.container.registerSingleton(AuditLogging_1.LogAudit, AuditLogging_1.LogAudit);
tsyringe_1.container.registerSingleton(CheckAuthentication_1.CheckAuthentication, CheckAuthentication_1.CheckAuthentication);
tsyringe_1.container.registerSingleton(LogoutUser_1.LogoutUser, LogoutUser_1.LogoutUser);
// Recipe use-cases and controller
tsyringe_1.container.registerSingleton(CreateRecipe_1.CreateRecipe, CreateRecipe_1.CreateRecipe);
tsyringe_1.container.registerSingleton(UpdateRecipe_1.UpdateRecipe, UpdateRecipe_1.UpdateRecipe);
tsyringe_1.container.registerSingleton(DeleteRecipe_1.DeleteRecipe, DeleteRecipe_1.DeleteRecipe);
tsyringe_1.container.registerSingleton(require("../03_adapters/controllers/RecipeController").RecipeController, require("../03_adapters/controllers/RecipeController").RecipeController);
// Register controllers
tsyringe_1.container.registerSingleton(UserController_1.UserController, UserController_1.UserController);
tsyringe_1.container.registerSingleton(GroceryController_1.GroceryController, GroceryController_1.GroceryController);
tsyringe_1.container.registerSingleton(MealPlanController_1.MealPlanController, MealPlanController_1.MealPlanController);
tsyringe_1.container.registerSingleton(ShoppingListController_1.ShoppingListController, ShoppingListController_1.ShoppingListController);
tsyringe_1.container.registerSingleton(RecipeActivityController_1.RecipeActivityController, RecipeActivityController_1.RecipeActivityController);
exports.default = tsyringe_1.container;
