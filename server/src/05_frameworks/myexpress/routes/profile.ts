import express from "express";
import { authenticateJWT } from "../jwtAuth";
import "../../../04_factories/di";
import { container } from "tsyringe";
import { UserController } from "../../../03_adapters/controllers/UserController";

console.log("📥 Importing profile.routes");

const router = express.Router();

const userController = container.resolve(UserController);

router.get("/profile", authenticateJWT, async (req, res) => {
  await userController.getProfile(req, res);
});
router.put("/profile", authenticateJWT, async (req, res) => {
  try {
    await userController.updateProfile(req, res);
  } catch (err) {
    console.error("Failed to update profile", err);
    res.status(500).json({ error: "Update failed" });
  }
});

export default router;
