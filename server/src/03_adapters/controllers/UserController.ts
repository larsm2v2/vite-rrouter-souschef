import { Request, Response } from "express";
import { User } from "../../01_entities/User";
import { GetUserProfile } from "../../02_use_cases/GetUserProfile";
import { UpdateUserProfile } from "../../02_use_cases/UpdateUserProfile";
import { injectable, inject } from "tsyringe";

@injectable()
export class UserController {
  constructor(
    @inject(GetUserProfile) private getUserProfile: GetUserProfile,
    @inject(UpdateUserProfile) private updateUserProfile: UpdateUserProfile
  ) {}

  async getProfile(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // We checked above that `req.user` is present, so assert it as User
    const userId = (req.user as User).id;
    const userProfile = await this.getUserProfile.execute(userId);

    if (!userProfile) {
      res.status(404).json({ error: "User not found" });
    } else {
      res.status(200).json(userProfile);
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = (req.user as User).id;
    const update: Partial<User> = {};
    if (typeof req.body.display_name !== "undefined")
      update.displayName = req.body.display_name;
    if (typeof req.body.avatar !== "undefined") update.avatar = req.body.avatar;
    const updated = await this.updateUserProfile.execute(userId, update);
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(200).json({ user: updated });
  }
}
