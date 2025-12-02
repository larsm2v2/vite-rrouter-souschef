import "reflect-metadata"; // ensure reflect metadata is available
import { container } from "tsyringe";

// Repositories
import { UserRepository } from "../03_adapters/repositories/UserRepository";
import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";
import { GroceryRepository } from "../03_adapters/repositories/GroceryRepository";
import { MealPlanRepository } from "../03_adapters/repositories/MealPlanRepository";
import { ShoppingListVersionRepository } from "../03_adapters/repositories/ShoppingListVersionRepository";
import { RecipeActivityLogRepository } from "../03_adapters/repositories/RecipeActivityLogRepository";

// Use-cases
import { GetUserProfile } from "../02_use_cases/GetUserProfile";
import { UpdateUserProfile } from "../02_use_cases/UpdateUserProfile";
import { GetGroceryList } from "../02_use_cases/GetGroceryList";
import { GetMealPlan } from "../02_use_cases/GetMealPlan";
import { CreateMealPlan } from "../02_use_cases/CreateMealPlan";
import { GetShoppingListVersion } from "../02_use_cases/GetShoppingListVersion";
import { CreateShoppingListVersion } from "../02_use_cases/CreateShoppingListVersion";
import { LogRecipeActivity } from "../02_use_cases/LogRecipeActivity";
import { GetRecipeActivityLog } from "../02_use_cases/GetRecipeActivityLog";
import { CreateRecipe } from "../02_use_cases/CreateRecipe";
import { UpdateRecipe } from "../02_use_cases/UpdateRecipe";
import { DeleteRecipe } from "../02_use_cases/DeleteRecipe";
import { LogAudit } from "../02_use_cases/AuditLogging";
import { CheckAuthentication } from "../02_use_cases/CheckAuthentication";
import { LogoutUser } from "../02_use_cases/LogoutUser";

// Controllers
import { UserController } from "../03_adapters/controllers/UserController";
import { GroceryController } from "../03_adapters/controllers/GroceryController";
import { MealPlanController } from "../03_adapters/controllers/MealPlanController";
import { ShoppingListController } from "../03_adapters/controllers/ShoppingListController";
import { RecipeActivityController } from "../03_adapters/controllers/RecipeActivityController";

// Register repositories as singletons
container.registerSingleton(UserRepository, UserRepository);
container.registerSingleton(RecipeRepository, RecipeRepository);
container.registerSingleton(GroceryRepository, GroceryRepository);
container.registerSingleton(MealPlanRepository, MealPlanRepository);
container.registerSingleton(
  ShoppingListVersionRepository,
  ShoppingListVersionRepository
);
container.registerSingleton(
  RecipeActivityLogRepository,
  RecipeActivityLogRepository
);

// Register use-cases
container.registerSingleton(GetUserProfile, GetUserProfile);
container.registerSingleton(UpdateUserProfile, UpdateUserProfile);
container.registerSingleton(GetGroceryList, GetGroceryList);
container.registerSingleton(GetMealPlan, GetMealPlan);
container.registerSingleton(CreateMealPlan, CreateMealPlan);
container.registerSingleton(GetShoppingListVersion, GetShoppingListVersion);
container.registerSingleton(
  CreateShoppingListVersion,
  CreateShoppingListVersion
);
container.registerSingleton(LogRecipeActivity, LogRecipeActivity);
container.registerSingleton(GetRecipeActivityLog, GetRecipeActivityLog);

// Additional use-cases
container.registerSingleton(LogAudit, LogAudit);
container.registerSingleton(CheckAuthentication, CheckAuthentication);
container.registerSingleton(LogoutUser, LogoutUser);
// Recipe use-cases and controller
container.registerSingleton(CreateRecipe, CreateRecipe);
container.registerSingleton(UpdateRecipe, UpdateRecipe);
container.registerSingleton(DeleteRecipe, DeleteRecipe);
container.registerSingleton(
  require("../03_adapters/controllers/RecipeController").RecipeController,
  require("../03_adapters/controllers/RecipeController").RecipeController
);

// Register controllers
container.registerSingleton(UserController, UserController);
container.registerSingleton(GroceryController, GroceryController);
container.registerSingleton(MealPlanController, MealPlanController);
container.registerSingleton(ShoppingListController, ShoppingListController);
container.registerSingleton(RecipeActivityController, RecipeActivityController);

export default container;
