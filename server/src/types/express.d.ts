import { User } from "./entities/User";

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      display_name: string;
    }
  }
}
