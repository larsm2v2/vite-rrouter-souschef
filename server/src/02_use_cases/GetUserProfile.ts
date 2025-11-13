import { User } from "../01_entities";
import { UserRepository } from "../03_adapters/repositories/UserRepository";
import { injectable, inject } from "tsyringe";

@injectable()
export class GetUserProfile {
  constructor(@inject(UserRepository) private userRepository: UserRepository) {}

  async execute(userId: number): Promise<User | null> {
    return this.userRepository.findById(userId);
  }
}
