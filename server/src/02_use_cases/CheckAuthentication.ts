export class CheckAuthentication {
  async execute(user: any): Promise<{ authenticated: boolean; user?: any }> {
    if (!user) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    };
  }
}
