"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogRecipeActivity = createLogRecipeActivity;
exports.createGetRecipeActivityLog = createGetRecipeActivityLog;
const repositories_1 = require("../03_adapters/repositories");
const LogRecipeActivity_1 = require("../02_use_cases/LogRecipeActivity");
const GetRecipeActivityLog_1 = require("../02_use_cases/GetRecipeActivityLog");
function createLogRecipeActivity() {
    const repo = new repositories_1.RecipeActivityLogRepository();
    return new LogRecipeActivity_1.LogRecipeActivity(repo);
}
function createGetRecipeActivityLog() {
    const repo = new repositories_1.RecipeActivityLogRepository();
    return new GetRecipeActivityLog_1.GetRecipeActivityLog(repo);
}
