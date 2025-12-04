import { injectable, inject } from "tsyringe";
import { AlreadyStockedRepository } from "../03_adapters/repositories/AlreadyStockedRepository";
import { AlreadyStocked, StockedItem } from "../01_entities/AlreadyStocked";

@injectable()
export class UpdateAlreadyStocked {
  constructor(
    @inject("AlreadyStockedRepository")
    private alreadyStockedRepository: AlreadyStockedRepository
  ) {}

  async execute(
    userId: number,
    stockedItems: StockedItem[]
  ): Promise<AlreadyStocked> {
    return this.alreadyStockedRepository.upsert(userId, stockedItems);
  }
}
