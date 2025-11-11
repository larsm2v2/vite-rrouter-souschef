import { GroceryController } from "../03_adapters/controllers/GroceryController";
import { GroceryRepository } from "../03_adapters/repositories/GroceryRepository";
import { GetGroceryList } from "../02_use_cases/GetGroceryList";

export function createGroceryController(): GroceryController {
  const groceryRepository = new GroceryRepository();
  const getGroceryList = new GetGroceryList(groceryRepository);
  return new GroceryController(getGroceryList);
}
