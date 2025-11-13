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
exports.RecipeActivityLogRepository = void 0;
const connection_1 = __importDefault(require("../../05_frameworks/database/connection"));
const tsyringe_1 = require("tsyringe");
let RecipeActivityLogRepository = class RecipeActivityLogRepository {
    logActivity(entry) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield connection_1.default.query(`INSERT INTO recipe_activity_log (user_id, recipe_id, activity_type, activity_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id AS "userId", recipe_id AS "recipeId", activity_type AS "activityType", activity_data AS "activityData", created_at AS "createdAt"`, [entry.userId, entry.recipeId, entry.activityType, entry.activityData]);
            return result.rows[0];
        });
    }
    findByUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield connection_1.default.query(`SELECT id, user_id AS "userId", recipe_id AS "recipeId", activity_type AS "activityType", activity_data AS "activityData", created_at AS "createdAt"
       FROM recipe_activity_log
       WHERE user_id = $1
       ORDER BY created_at DESC`, [userId]);
            return result.rows;
        });
    }
};
exports.RecipeActivityLogRepository = RecipeActivityLogRepository;
exports.RecipeActivityLogRepository = RecipeActivityLogRepository = __decorate([
    (0, tsyringe_1.injectable)()
], RecipeActivityLogRepository);
