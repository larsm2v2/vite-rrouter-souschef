import { injectable, inject } from "tsyringe";
import { AlreadyStockedRepository } from "../03_adapters/repositories/AlreadyStockedRepository";
import { AlreadyStocked } from "../01_entities/AlreadyStocked";

@injectable()
export class GetAlreadyStocked {
  constructor(
    @inject(AlreadyStockedRepository)
    private alreadyStockedRepository: AlreadyStockedRepository
  ) {}

  async execute(userId: number): Promise<AlreadyStocked | null> {
    return this.alreadyStockedRepository.getByUser(userId);
  }
}
