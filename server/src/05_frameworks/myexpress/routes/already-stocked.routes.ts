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

export default alreadyStockedRouter;
