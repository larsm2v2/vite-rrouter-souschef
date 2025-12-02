import { createGetUserProfile, createUpdateUserProfile } from "./GetUserProfileFactory";
import { UserController } from "../03_adapters/controllers/UserController";

export function createUserController(): UserController {
  const getUserProfile = createGetUserProfile();
  const updateUserProfile = createUpdateUserProfile();
  return new UserController(getUserProfile, updateUserProfile);
}
