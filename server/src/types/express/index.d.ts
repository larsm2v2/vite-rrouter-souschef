// Augment Express.User with the fields used by our application.
// We avoid importing the entity `User` here to prevent type collisions
// and to make the augmentation ambient and always available to the compiler.

import type { User as EntityUser } from "../../01_entities/User";

declare global {
  namespace Express {
    // Reuse canonical User entity shape (type-only import) for shared fields.
    // We extend Partial<EntityUser> so that DB-only fields don't become required
    // on the request object. Keep id required as middleware sets it.
    interface User extends Partial<EntityUser> {
      id: number;
      // Keep both snake_case and camelCase for gradual migration
      display_name?: string;
      displayName?: string;
    }
  }
}

export {};
