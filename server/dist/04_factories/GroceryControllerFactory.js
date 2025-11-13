"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGroceryController = createGroceryController;
const GroceryController_1 = require("../03_adapters/controllers/GroceryController");
const GroceryRepository_1 = require("../03_adapters/repositories/GroceryRepository");
const GetGroceryList_1 = require("../02_use_cases/GetGroceryList");
function createGroceryController() {
    const groceryRepository = new GroceryRepository_1.GroceryRepository();
    const getGroceryList = new GetGroceryList_1.GetGroceryList(groceryRepository);
    return new GroceryController_1.GroceryController(getGroceryList);
}
