import { LogoutUser } from "../02_use_cases/LogoutUser";

export function createLogoutUser(): LogoutUser {
  return new LogoutUser();
}
