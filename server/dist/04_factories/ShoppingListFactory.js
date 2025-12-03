"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGetGroceryListVersion = createGetGroceryListVersion;
exports.createCreateGroceryListVersion = createCreateGroceryListVersion;
const repositories_1 = require("../03_adapters/repositories");
const GetGroceryListVersion_1 = require("../02_use_cases/GetGroceryListVersion");
const CreateGroceryListVersion_1 = require("../02_use_cases/CreateGroceryListVersion");
function createGetGroceryListVersion() {
  const repo = new repositories_1.GroceryListVersionRepository();
  return new GetGroceryListVersion_1.GetGroceryListVersion(repo);
}
function createCreateGroceryListVersion() {
  const repo = new repositories_1.GroceryListVersionRepository();
  return new CreateGroceryListVersion_1.CreateGroceryListVersion(repo);
}
