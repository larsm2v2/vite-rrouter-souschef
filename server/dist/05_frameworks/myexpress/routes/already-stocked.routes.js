"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tsyringe_1 = require("tsyringe");
const jwtAuth_1 = require("../jwtAuth");
require("../../../04_factories/di");
const AlreadyStockedController_1 = require("../../../03_adapters/controllers/AlreadyStockedController");
const alreadyStockedRouter = (0, express_1.Router)();
const alreadyStockedController = tsyringe_1.container.resolve(AlreadyStockedController_1.AlreadyStockedController);
// GET already stocked items for current user
alreadyStockedRouter.get("/", jwtAuth_1.authenticateJWT, (req, res) => alreadyStockedController.getAlreadyStocked(req, res));
// POST/PATCH already stocked items for current user
alreadyStockedRouter.post("/", jwtAuth_1.authenticateJWT, (req, res) => alreadyStockedController.updateAlreadyStocked(req, res));
exports.default = alreadyStockedRouter;
