import { Router } from "express";
import { container } from "tsyringe";
import { authenticateJWT } from "../jwtAuth";
import "../../../04_factories/di";
import { AlreadyStockedController } from "../../../03_adapters/controllers/AlreadyStockedController";
import { asyncHandler } from "../utils/asyncHandler";

const alreadyStockedRouter = Router();
const alreadyStockedController = container.resolve(AlreadyStockedController);

// GET already stocked items for current user
alreadyStockedRouter.get(
  "/",
  authenticateJWT,
  asyncHandler((req, res) =>
    alreadyStockedController.getAlreadyStocked(req, res),
  ),
);

// POST/PATCH already stocked items for current user
alreadyStockedRouter.post(
  "/",
  authenticateJWT,
  asyncHandler((req, res) =>
    alreadyStockedController.updateAlreadyStocked(req, res),
  ),
);

// Merge items into staples without replacing the list
alreadyStockedRouter.post(
  "/items",
  authenticateJWT,
  asyncHandler((req, res) => alreadyStockedController.addItems(req, res)),
);

// Starter staples to seed the list
alreadyStockedRouter.get("/suggestions", authenticateJWT, (req, res) =>
  alreadyStockedController.suggestions(req, res),
);

export default alreadyStockedRouter;
