import { ShoppingListVersion } from "../01_entities";
import { ShoppingListVersionRepository } from "../03_adapters/repositories";
import { injectable, inject } from "tsyringe";

@injectable()
export class GetShoppingListVersion {
  constructor(
    @inject(ShoppingListVersionRepository)
    private repo: ShoppingListVersionRepository
  ) {}

  async execute(userId: number): Promise<ShoppingListVersion | null> {
    return this.repo.findCurrentByUser(userId);
  }
}

export default GetShoppingListVersion;
