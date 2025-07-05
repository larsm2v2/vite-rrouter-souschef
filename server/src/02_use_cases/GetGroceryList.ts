import { GroceryItem } from "../01_entities";
import { GroceryRepository } from "../03_adapters/repositories/GroceryRepository";

export class GetGroceryList {
  constructor(private groceryRepository: GroceryRepository) {}

  async execute(userId: number): Promise<GroceryItem[]> {
    return this.groceryRepository.findByUserId(userId);
  }
}
