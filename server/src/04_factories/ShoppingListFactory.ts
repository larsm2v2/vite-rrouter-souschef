import { GroceryListVersionRepository } from "../03_adapters/repositories";
import { GetGroceryListVersion } from "../02_use_cases/GetGroceryListVersion";
import { CreateGroceryListVersion } from "../02_use_cases/CreateGroceryListVersion";

export function createGetGroceryListVersion(): GetGroceryListVersion {
  const repo = new GroceryListVersionRepository();
  return new GetGroceryListVersion(repo);
}

export function createCreateGroceryListVersion(): CreateGroceryListVersion {
  const repo = new GroceryListVersionRepository();
  return new CreateGroceryListVersion(repo);
}
