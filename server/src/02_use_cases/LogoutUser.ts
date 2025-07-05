export class LogoutUser {
  async execute(req: any): Promise<void> {
    return new Promise((resolve, reject) => {
      req.logout((err: Error) => {
        if (err) {
          return reject(err);
        }

        req.session?.destroy((err: Error) => {
          if (err) {
            return reject(err);
          }

          resolve();
        });
      });
    });
  }
}
