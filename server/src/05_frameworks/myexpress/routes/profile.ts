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

export default router;
