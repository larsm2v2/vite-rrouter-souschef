import express from "express";
import { createGroceryController } from "../../../04_factories/GroceryControllerFactory";

const router = express.Router();

const groceryController = createGroceryController();

router.get("/user/:userId/grocery-list", async (req, res, next) => {
  try {
    await groceryController.getList(req, res);
  } catch (err) {
    next(err);
  }
});

export default router;
