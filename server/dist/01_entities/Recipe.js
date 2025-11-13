"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeSchema = void 0;
const typeorm_1 = require("typeorm");
exports.RecipeSchema = new typeorm_1.EntitySchema({
    name: "Recipe",
    columns: {
        id: {
            type: Number,
            primary: true,
            generated: true,
        },
        userId: {
            type: Number,
        },
        uniqueId: {
            type: Number,
            unique: true,
        },
        name: {
            type: String,
        },
        slug: {
            type: String,
            unique: true,
        },
        cuisine: {
            type: String,
            nullable: true,
        },
        mealType: {
            type: String,
            nullable: true,
        },
        dietaryRestrictions: {
            type: "simple-array", // PostgreSQL array type
            nullable: true,
        },
        servingInfo: {
            type: "json", // JSON type for complex objects
            nullable: true,
        },
        ingredients: {
            type: "json", // JSON type for complex objects
            nullable: true,
        },
        instructions: {
            type: "json", // JSON type for complex objects
            nullable: true,
        },
        notes: {
            type: "simple-array", // PostgreSQL array type
            nullable: true,
        },
        nutrition: {
            type: "json", // JSON type for complex objects
            nullable: true,
        },
        createdAt: {
            type: Date,
            createDate: true,
        },
        updatedAt: {
            type: Date,
            updateDate: true,
        },
    },
});
