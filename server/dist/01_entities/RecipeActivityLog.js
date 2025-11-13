"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeActivityLogSchema = void 0;
const typeorm_1 = require("typeorm");
exports.RecipeActivityLogSchema = new typeorm_1.EntitySchema({
    name: "RecipeActivityLog",
    columns: {
        id: { type: Number, primary: true, generated: true },
        userId: { type: Number },
        recipeId: { type: Number },
        activityType: { type: String },
        activityData: { type: "json", nullable: true },
        createdAt: { type: Date, createDate: true },
    },
});
