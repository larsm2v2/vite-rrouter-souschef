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
exports.RecipeActivityController = void 0;
const _02_use_cases_1 = require("../../02_use_cases");
const tsyringe_1 = require("tsyringe");
let RecipeActivityController = class RecipeActivityController {
    constructor(logger, getter) {
        this.logger = logger;
        this.getter = getter;
    }
    log(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const entry = Object.assign(Object.assign({}, (req.body || {})), { userId });
            const created = yield this.logger.execute(entry);
            res.status(201).json(created);
        });
    }
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const logs = yield this.getter.execute(userId);
            res.status(200).json(logs);
        });
    }
};
exports.RecipeActivityController = RecipeActivityController;
exports.RecipeActivityController = RecipeActivityController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(_02_use_cases_1.LogRecipeActivity)),
    __param(1, (0, tsyringe_1.inject)(_02_use_cases_1.GetRecipeActivityLog)),
    __metadata("design:paramtypes", [_02_use_cases_1.LogRecipeActivity,
        _02_use_cases_1.GetRecipeActivityLog])
], RecipeActivityController);
