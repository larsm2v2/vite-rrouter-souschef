"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealPlanRepository = void 0;
const connection_1 = __importDefault(require("../../05_frameworks/database/connection"));
const tsyringe_1 = require("tsyringe");
let MealPlanRepository = class MealPlanRepository {
    findByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield connection_1.default.query(`SELECT id, user_id AS "userId", recipe_id AS "recipeId", planned_date AS "plannedDate",
              meal_type AS "mealType", is_cooked AS "isCooked", cooked_date AS "cookedDate",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM meal_plan
       WHERE user_id = $1
       ORDER BY planned_date DESC`, [userId]);
            return result.rows;
        });
    }
    create(entry) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield connection_1.default.query(`INSERT INTO meal_plan (user_id, recipe_id, planned_date, meal_type, is_cooked, cooked_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id AS "userId", recipe_id AS "recipeId", planned_date AS "plannedDate",
                 meal_type AS "mealType", is_cooked AS "isCooked", cooked_date AS "cookedDate",
                 created_at AS "createdAt", updated_at AS "updatedAt"`, [
                entry.userId,
                entry.recipeId,
                entry.plannedDate,
                entry.mealType,
                entry.isCooked || false,
                entry.cookedDate,
            ]);
            return result.rows[0];
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const result = yield connection_1.default.query(`DELETE FROM meal_plan WHERE id = $1`, [
                id,
            ]);
            return ((_a = result.rowCount) !== null && _a !== void 0 ? _a : 0) > 0;
        });
    }
};
exports.MealPlanRepository = MealPlanRepository;
exports.MealPlanRepository = MealPlanRepository = __decorate([
    (0, tsyringe_1.injectable)()
], MealPlanRepository);
