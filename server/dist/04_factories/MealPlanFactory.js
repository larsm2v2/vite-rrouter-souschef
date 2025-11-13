"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGetMealPlan = createGetMealPlan;
exports.createCreateMealPlan = createCreateMealPlan;
const repositories_1 = require("../03_adapters/repositories");
const GetMealPlan_1 = require("../02_use_cases/GetMealPlan");
const CreateMealPlan_1 = require("../02_use_cases/CreateMealPlan");
function createGetMealPlan() {
    const repo = new repositories_1.MealPlanRepository();
    return new GetMealPlan_1.GetMealPlan(repo);
}
function createCreateMealPlan() {
    const repo = new repositories_1.MealPlanRepository();
    return new CreateMealPlan_1.CreateMealPlan(repo);
}
