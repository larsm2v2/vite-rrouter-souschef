import { Request, Response } from "express";
import { GetUserProfile } from "../../02_use_cases/GetUserProfile";
import { injectable, inject } from "tsyringe";

@injectable()
export class UserController {
  constructor(@inject(GetUserProfile) private getUserProfile: GetUserProfile) {}

  async getProfile(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.user.id;
    const userProfile = await this.getUserProfile.execute(userId);

    if (!userProfile) {
      res.status(404).json({ error: "User not found" });
    } else {
      res.status(200).json(userProfile);
    }
  }
}
