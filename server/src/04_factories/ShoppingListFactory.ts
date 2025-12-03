import { ShoppingListVersionRepository } from "../03_adapters/repositories";
import { GetShoppingListVersion } from "../02_use_cases/GetShoppingListVersion";
import { CreateShoppingListVersion } from "../02_use_cases/CreateShoppingListVersion";

export function createGetShoppingListVersion(): GetShoppingListVersion {
  const repo = new ShoppingListVersionRepository();
  return new GetShoppingListVersion(repo);
}

export function createCreateShoppingListVersion(): CreateShoppingListVersion {
  const repo = new ShoppingListVersionRepository();
  return new CreateShoppingListVersion(repo);
}
