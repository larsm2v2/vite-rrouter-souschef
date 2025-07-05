import { UserRepository } from "../03_adapters/repositories";
import { GetUserProfile } from "../02_use_cases";

export function createGetUserProfile(): GetUserProfile {
  const userRepository = new UserRepository();
  return new GetUserProfile(userRepository);
}
