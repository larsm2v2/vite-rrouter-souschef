import { ShoppingListVersion } from "../01_entities";
import { ShoppingListVersionRepository } from "../03_adapters/repositories";
import { injectable, inject } from "tsyringe";

@injectable()
export class CreateShoppingListVersion {
  constructor(
    @inject(ShoppingListVersionRepository)
    private repo: ShoppingListVersionRepository,
  ) {}

  /** Replace the user's list. Pass baseVersion to refuse overwriting a newer list. */
  async execute(
    userId: number,
    listData: unknown[],
    baseVersion?: number,
  ): Promise<ShoppingListVersion> {
    return this.repo.saveVersion(userId, () => listData, baseVersion);
  }
}

export default CreateShoppingListVersion;
