import { ShoppingListVersion } from "../01_entities";
import { ShoppingListVersionRepository } from "../03_adapters/repositories";
import { injectable, inject } from "tsyringe";

@injectable()
export class CreateShoppingListVersion {
  constructor(
    @inject(ShoppingListVersionRepository)
    private repo: ShoppingListVersionRepository
  ) {}

  async execute(
    entry: Partial<ShoppingListVersion>
  ): Promise<ShoppingListVersion> {
    return this.repo.createVersion(entry);
  }
}

export default CreateShoppingListVersion;
