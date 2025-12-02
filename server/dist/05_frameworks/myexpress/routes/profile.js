"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jwtAuth_1 = require("../jwtAuth");
require("../../../04_factories/di");
const tsyringe_1 = require("tsyringe");
const UserController_1 = require("../../../03_adapters/controllers/UserController");
console.log("📥 Importing profile.routes");
const router = express_1.default.Router();
const userController = tsyringe_1.container.resolve(UserController_1.UserController);
router.get("/profile", jwtAuth_1.authenticateJWT, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield userController.getProfile(req, res);
}));
router.put("/profile", jwtAuth_1.authenticateJWT, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield userController.updateProfile(req, res);
    }
    catch (err) {
        console.error("Failed to update profile", err);
        res.status(500).json({ error: "Update failed" });
    }
}));
exports.default = router;
