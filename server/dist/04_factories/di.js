"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata"); // ensure reflect metadata is available
const tsyringe_1 = require("tsyringe");
// Repositories
const UserRepository_1 = require("../03_adapters/repositories/UserRepository");
const RecipeRepository_1 = require("../03_adapters/repositories/RecipeRepository");
const GroceryRepository_1 = require("../03_adapters/repositories/GroceryRepository");
const MealPlanRepository_1 = require("../03_adapters/repositories/MealPlanRepository");
const GroceryListVersionRepository_1 = require("../03_adapters/repositories/GroceryListVersionRepository");
const RecipeActivityLogRepository_1 = require("../03_adapters/repositories/RecipeActivityLogRepository");
// Use-cases
const GetUserProfile_1 = require("../02_use_cases/GetUserProfile");
const UpdateUserProfile_1 = require("../02_use_cases/UpdateUserProfile");
const GetGroceryList_1 = require("../02_use_cases/GetGroceryList");
const GetMealPlan_1 = require("../02_use_cases/GetMealPlan");
const CreateMealPlan_1 = require("../02_use_cases/CreateMealPlan");
const GetGroceryListVersion_1 = require("../02_use_cases/GetGroceryListVersion");
const CreateGroceryListVersion_1 = require("../02_use_cases/CreateGroceryListVersion");
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
const GroceryListController_1 = require("../03_adapters/controllers/GroceryListController");
const RecipeActivityController_1 = require("../03_adapters/controllers/RecipeActivityController");
// Register repositories as singletons
tsyringe_1.container.registerSingleton(
  UserRepository_1.UserRepository,
  UserRepository_1.UserRepository
);
tsyringe_1.container.registerSingleton(
  RecipeRepository_1.RecipeRepository,
  RecipeRepository_1.RecipeRepository
);
tsyringe_1.container.registerSingleton(
  GroceryRepository_1.GroceryRepository,
  GroceryRepository_1.GroceryRepository
);
tsyringe_1.container.registerSingleton(
  MealPlanRepository_1.MealPlanRepository,
  MealPlanRepository_1.MealPlanRepository
);
tsyringe_1.container.registerSingleton(
  GroceryListVersionRepository_1.GroceryListVersionRepository,
  GroceryListVersionRepository_1.GroceryListVersionRepository
);
tsyringe_1.container.registerSingleton(
  RecipeActivityLogRepository_1.RecipeActivityLogRepository,
  RecipeActivityLogRepository_1.RecipeActivityLogRepository
);
// Register use-cases
tsyringe_1.container.registerSingleton(
  GetUserProfile_1.GetUserProfile,
  GetUserProfile_1.GetUserProfile
);
tsyringe_1.container.registerSingleton(
  UpdateUserProfile_1.UpdateUserProfile,
  UpdateUserProfile_1.UpdateUserProfile
);
tsyringe_1.container.registerSingleton(
  GetGroceryList_1.GetGroceryList,
  GetGroceryList_1.GetGroceryList
);
tsyringe_1.container.registerSingleton(
  GetMealPlan_1.GetMealPlan,
  GetMealPlan_1.GetMealPlan
);
tsyringe_1.container.registerSingleton(
  CreateMealPlan_1.CreateMealPlan,
  CreateMealPlan_1.CreateMealPlan
);
tsyringe_1.container.registerSingleton(
  GetGroceryListVersion_1.GetGroceryListVersion,
  GetGroceryListVersion_1.GetGroceryListVersion
);
tsyringe_1.container.registerSingleton(
  CreateGroceryListVersion_1.CreateGroceryListVersion,
  CreateGroceryListVersion_1.CreateGroceryListVersion
);
tsyringe_1.container.registerSingleton(
  LogRecipeActivity_1.LogRecipeActivity,
  LogRecipeActivity_1.LogRecipeActivity
);
tsyringe_1.container.registerSingleton(
  GetRecipeActivityLog_1.GetRecipeActivityLog,
  GetRecipeActivityLog_1.GetRecipeActivityLog
);
// Additional use-cases
tsyringe_1.container.registerSingleton(
  AuditLogging_1.LogAudit,
  AuditLogging_1.LogAudit
);
tsyringe_1.container.registerSingleton(
  CheckAuthentication_1.CheckAuthentication,
  CheckAuthentication_1.CheckAuthentication
);
tsyringe_1.container.registerSingleton(
  LogoutUser_1.LogoutUser,
  LogoutUser_1.LogoutUser
);
// Recipe use-cases and controller
tsyringe_1.container.registerSingleton(
  CreateRecipe_1.CreateRecipe,
  CreateRecipe_1.CreateRecipe
);
tsyringe_1.container.registerSingleton(
  UpdateRecipe_1.UpdateRecipe,
  UpdateRecipe_1.UpdateRecipe
);
tsyringe_1.container.registerSingleton(
  DeleteRecipe_1.DeleteRecipe,
  DeleteRecipe_1.DeleteRecipe
);
tsyringe_1.container.registerSingleton(
  require("../03_adapters/controllers/RecipeController").RecipeController,
  require("../03_adapters/controllers/RecipeController").RecipeController
);
// Register controllers
tsyringe_1.container.registerSingleton(
  UserController_1.UserController,
  UserController_1.UserController
);
tsyringe_1.container.registerSingleton(
  GroceryController_1.GroceryController,
  GroceryController_1.GroceryController
);
tsyringe_1.container.registerSingleton(
  MealPlanController_1.MealPlanController,
  MealPlanController_1.MealPlanController
);
tsyringe_1.container.registerSingleton(
  GroceryListController_1.GroceryListController,
  GroceryListController_1.GroceryListController
);
tsyringe_1.container.registerSingleton(
  RecipeActivityController_1.RecipeActivityController,
  RecipeActivityController_1.RecipeActivityController
);
exports.default = tsyringe_1.container;
