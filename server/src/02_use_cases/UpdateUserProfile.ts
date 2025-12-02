import { User } from "../01_entities";
import { UserRepository } from "../03_adapters/repositories/UserRepository";
import { injectable, inject } from "tsyringe";

@injectable()
export class UpdateUserProfile {
  constructor(@inject(UserRepository) private userRepository: UserRepository) {}

  async execute(userId: number, update: Partial<User>): Promise<User | null> {
    return this.userRepository.update(userId, update);
  }
}

export default UpdateUserProfile;
