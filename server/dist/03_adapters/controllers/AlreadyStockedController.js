"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlreadyStockedController = void 0;
const tsyringe_1 = require("tsyringe");
const GetAlreadyStocked_1 = require("../../02_use_cases/GetAlreadyStocked");
const UpdateAlreadyStocked_1 = require("../../02_use_cases/UpdateAlreadyStocked");
let AlreadyStockedController = class AlreadyStockedController {
    constructor(getAlreadyStockedUseCase, updateAlreadyStockedUseCase) {
        this.getAlreadyStockedUseCase = getAlreadyStockedUseCase;
        this.updateAlreadyStockedUseCase = updateAlreadyStockedUseCase;
    }
    getAlreadyStocked(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.userId;
                if (!userId) {
                    res.status(401).json({ error: "Unauthorized" });
                    return;
                }
                const alreadyStocked = yield this.getAlreadyStockedUseCase.execute(userId);
                res.status(200).json(alreadyStocked || { stockedItems: [] });
            }
            catch (error) {
                console.error("Error fetching already stocked:", error);
                res.status(500).json({ error: "Failed to fetch already stocked items" });
            }
        });
    }
    updateAlreadyStocked(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.userId;
                const { stockedItems } = req.body;
                if (!userId) {
                    res.status(401).json({ error: "Unauthorized" });
                    return;
                }
                if (!Array.isArray(stockedItems)) {
                    res.status(400).json({ error: "stockedItems must be an array" });
                    return;
                }
                // Validate items structure - only name is required
                for (const item of stockedItems) {
                    if (!item.name || typeof item.name !== "string") {
                        res.status(400).json({
                            error: "Each stocked item must have a name",
                        });
                        return;
                    }
                }
                const updated = yield this.updateAlreadyStockedUseCase.execute(userId, stockedItems);
                res.status(200).json(updated);
            }
            catch (error) {
                console.error("Error updating already stocked:", error);
                res.status(500).json({ error: "Failed to update already stocked items" });
            }
        });
    }
};
exports.AlreadyStockedController = AlreadyStockedController;
exports.AlreadyStockedController = AlreadyStockedController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)("GetAlreadyStocked")),
    __param(1, (0, tsyringe_1.inject)("UpdateAlreadyStocked")),
    __metadata("design:paramtypes", [GetAlreadyStocked_1.GetAlreadyStocked,
        UpdateAlreadyStocked_1.UpdateAlreadyStocked])
], AlreadyStockedController);
