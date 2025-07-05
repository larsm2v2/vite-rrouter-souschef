import { CheckAuthentication } from "../02_use_cases/CheckAuthentication";

export function createCheckAuthentication(): CheckAuthentication {
  return new CheckAuthentication();
}
