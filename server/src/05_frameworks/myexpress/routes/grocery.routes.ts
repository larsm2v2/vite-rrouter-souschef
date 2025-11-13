import express from "express";
import { authenticateJWT } from "../jwtAuth";
import "../../../04_factories/di";
import { container } from "tsyringe";
import { GroceryController } from "../../../03_adapters/controllers/GroceryController";

const router = express.Router();

const groceryController = container.resolve(GroceryController);

router.get(
  "/user/:userId/grocery-list",
  authenticateJWT,
  async (req, res, next) => {
    try {
      await groceryController.getList(req, res);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
