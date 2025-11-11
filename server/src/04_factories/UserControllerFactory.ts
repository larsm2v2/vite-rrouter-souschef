import { createGetUserProfile } from "./GetUserProfileFactory";
import { UserController } from "../03_adapters/controllers/UserController";

export function createUserController(): UserController {
  const getUserProfile = createGetUserProfile();
  return new UserController(getUserProfile);
}
