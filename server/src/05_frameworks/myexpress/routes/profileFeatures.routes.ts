import { Router } from "express";
import { authenticateJWT } from "../jwtAuth";
import "../../../04_factories/di"; // ensure DI container is configured
import { container } from "tsyringe";
import { MealPlanController } from "../../../03_adapters/controllers/MealPlanController";
import { ShoppingListController } from "../../../03_adapters/controllers/ShoppingListController";
import { RecipeActivityController } from "../../../03_adapters/controllers/RecipeActivityController";
import { asyncHandler } from "../utils/asyncHandler";

console.log("📥 Importing profileFeatures.routes");
const router = Router();

// Apply authentication to all routes in this router
router.use(authenticateJWT);

// Meal plans
router.get(
  "/meal-plan",
  asyncHandler(async (req, res) => {
    const controller = container.resolve(MealPlanController);
    return controller.getForUser(req, res);
  }),
);

router.post(
  "/meal-plan",
  asyncHandler(async (req, res) => {
    const controller = container.resolve(MealPlanController);
    return controller.create(req, res);
  }),
);

// Grocery list versions
router.get(
  "/grocery-list/version",
  asyncHandler(async (req, res) => {
    const controller = container.resolve(ShoppingListController);
    return controller.getCurrent(req, res);
  }),
);

router.post(
  "/grocery-list/version",
  asyncHandler(async (req, res) => {
    const controller = container.resolve(ShoppingListController);
    return controller.create(req, res);
  }),
);

// Recipe activity logs
router.post(
  "/recipe-activity",
  asyncHandler(async (req, res) => {
    const controller = container.resolve(RecipeActivityController);
    return controller.log(req, res);
  }),
);

router.get(
  "/recipe-activity",
  asyncHandler(async (req, res) => {
    const controller = container.resolve(RecipeActivityController);
    return controller.list(req, res);
  }),
);

export default router;
