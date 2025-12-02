import { UserRepository } from "../03_adapters/repositories";
import { GetUserProfile } from "../02_use_cases";
import { UpdateUserProfile } from "../02_use_cases/UpdateUserProfile";

export function createGetUserProfile(): GetUserProfile {
  const userRepository = new UserRepository();
  return new GetUserProfile(userRepository);
}

export function createUpdateUserProfile(): UpdateUserProfile {
  const userRepository = new UserRepository();
  return new UpdateUserProfile(userRepository);
}
