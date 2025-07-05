import { User } from "../01_entities";
import { UserRepository } from "../03_adapters/repositories/UserRepository";

export class GetUserProfile {
  constructor(private userRepository: UserRepository) {}

  async execute(userId: number): Promise<User | null> {
    return this.userRepository.findById(userId);
  }
}
