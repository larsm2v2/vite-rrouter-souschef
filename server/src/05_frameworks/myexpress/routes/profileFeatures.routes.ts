import { Router } from "express";
import { authenticateJWT } from "../jwtAuth";
import "../../../04_factories/di"; // ensure DI container is configured
import { container } from "tsyringe";
import { MealPlanController } from "../../../03_adapters/controllers/MealPlanController";
import { ShoppingListController } from "../../../03_adapters/controllers/ShoppingListController";
import { RecipeActivityController } from "../../../03_adapters/controllers/RecipeActivityController";

console.log("📥 Importing profileFeatures.routes");
const router = Router();

// Apply authentication to all routes in this router
router.use(authenticateJWT);

// Meal plans
router.get("/meal-plan", async (req, res) => {
  const controller = container.resolve(MealPlanController);
  return controller.getForUser(req, res);
});

router.post("/meal-plan", async (req, res) => {
  const controller = container.resolve(MealPlanController);
  return controller.create(req, res);
});

// Shopping list versions
router.get("/shopping-list/version", async (req, res) => {
  const controller = container.resolve(ShoppingListController);
  return controller.getCurrent(req, res);
});

router.post("/shopping-list/version", async (req, res) => {
  const controller = container.resolve(ShoppingListController);
  return controller.create(req, res);
});

// Recipe activity logs
router.post("/recipe-activity", async (req, res) => {
  const controller = container.resolve(RecipeActivityController);
  return controller.log(req, res);
});

router.get("/recipe-activity", async (req, res) => {
  const controller = container.resolve(RecipeActivityController);
  return controller.list(req, res);
});

export default router;
