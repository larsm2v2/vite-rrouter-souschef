"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jwtAuth_1 = require("../jwtAuth");
require("../../../04_factories/di"); // ensure DI container is configured
const tsyringe_1 = require("tsyringe");
const MealPlanController_1 = require("../../../03_adapters/controllers/MealPlanController");
const ShoppingListController_1 = require("../../../03_adapters/controllers/ShoppingListController");
const RecipeActivityController_1 = require("../../../03_adapters/controllers/RecipeActivityController");
const router = (0, express_1.Router)();
// Apply authentication to all routes in this router
router.use(jwtAuth_1.authenticateJWT);
// Meal plans
router.get("/meal-plan", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const controller = tsyringe_1.container.resolve(MealPlanController_1.MealPlanController);
    return controller.getForUser(req, res);
}));
router.post("/meal-plan", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const controller = tsyringe_1.container.resolve(MealPlanController_1.MealPlanController);
    return controller.create(req, res);
}));
// Shopping list versions
router.get("/shopping-list/version", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const controller = tsyringe_1.container.resolve(ShoppingListController_1.ShoppingListController);
    return controller.getCurrent(req, res);
}));
router.post("/shopping-list/version", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const controller = tsyringe_1.container.resolve(ShoppingListController_1.ShoppingListController);
    return controller.create(req, res);
}));
// Recipe activity logs
router.post("/recipe-activity", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const controller = tsyringe_1.container.resolve(RecipeActivityController_1.RecipeActivityController);
    return controller.log(req, res);
}));
router.get("/recipe-activity", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const controller = tsyringe_1.container.resolve(RecipeActivityController_1.RecipeActivityController);
    return controller.list(req, res);
}));
exports.default = router;
