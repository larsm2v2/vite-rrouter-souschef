import { GroceryListVersion } from "../01_entities";
import { GroceryListVersionRepository } from "../03_adapters/repositories";
import { injectable, inject } from "tsyringe";

@injectable()
export class GetGroceryListVersion {
  constructor(
    @inject(GroceryListVersionRepository)
    private repo: GroceryListVersionRepository
  ) {}

  async execute(userId: number): Promise<GroceryListVersion | null> {
    return this.repo.findCurrentByUser(userId);
  }
}

export default GetGroceryListVersion;
