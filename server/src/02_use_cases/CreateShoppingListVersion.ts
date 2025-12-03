import { GroceryListVersion } from "../01_entities";
import { GroceryListVersionRepository } from "../03_adapters/repositories";
import { injectable, inject } from "tsyringe";

@injectable()
export class CreateGroceryListVersion {
  constructor(
    @inject(GroceryListVersionRepository)
    private repo: GroceryListVersionRepository
  ) {}

  async execute(
    entry: Partial<GroceryListVersion>
  ): Promise<GroceryListVersion> {
    return this.repo.createVersion(entry);
  }
}

export default CreateGroceryListVersion;
