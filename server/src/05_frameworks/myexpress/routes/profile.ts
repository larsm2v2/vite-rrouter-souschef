import express from "express";
import { createUserController } from "../../../04_factories/UserControllerFactory";

const router = express.Router();

const userController = createUserController();

router.get("/profile", async (req, res) => {
  await userController.getProfile(req, res);
});

export default router;
