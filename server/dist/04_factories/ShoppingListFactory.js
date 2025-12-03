"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGetShoppingListVersion = createGetShoppingListVersion;
exports.createCreateShoppingListVersion = createCreateShoppingListVersion;
const repositories_1 = require("../03_adapters/repositories");
const GetShoppingListVersion_1 = require("../02_use_cases/GetShoppingListVersion");
const CreateShoppingListVersion_1 = require("../02_use_cases/CreateShoppingListVersion");
function createGetShoppingListVersion() {
    const repo = new repositories_1.ShoppingListVersionRepository();
    return new GetShoppingListVersion_1.GetShoppingListVersion(repo);
}
function createCreateShoppingListVersion() {
    const repo = new repositories_1.ShoppingListVersionRepository();
    return new CreateShoppingListVersion_1.CreateShoppingListVersion(repo);
}
