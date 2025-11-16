// Augment Express.User with the fields used by our application.
// We avoid importing the entity `User` here to prevent type collisions
// and to make the augmentation ambient and always available to the compiler.
declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      // Some parts of the codebase expect snake_case (display_name)
      // while some use camelCase (displayName). Provide both optional
      // properties so both styles compile.
      display_name?: string;
      displayName?: string;
      // Additional common fields added by auth flows
      googleSub?: string;
      avatar?: string;
    }
  }
}
