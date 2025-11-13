"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrocerySchema = void 0;
const typeorm_1 = require("typeorm");
exports.GrocerySchema = new typeorm_1.EntitySchema({
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
        recipeId: {
            type: Number,
            nullable: true,
        },
        itemName: {
            type: String,
        },
        quantity: {
            type: Number,
            nullable: true,
        },
        unit: {
            type: String,
            nullable: true,
        },
        isChecked: {
            type: Boolean,
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
