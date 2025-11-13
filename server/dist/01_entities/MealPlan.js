"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealPlanSchema = void 0;
const typeorm_1 = require("typeorm");
exports.MealPlanSchema = new typeorm_1.EntitySchema({
    name: "MealPlan",
    columns: {
        id: { type: Number, primary: true, generated: true },
        userId: { type: Number },
        recipeId: { type: Number },
        plannedDate: { type: Date },
        mealType: { type: String, nullable: true },
        isCooked: { type: Boolean, default: false },
        cookedDate: { type: Date, nullable: true },
        createdAt: { type: Date, createDate: true },
        updatedAt: { type: Date, updateDate: true },
    },
});
