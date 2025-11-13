"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSchema = void 0;
const typeorm_1 = require("typeorm");
exports.UserSchema = new typeorm_1.EntitySchema({
    name: "User",
    columns: {
        id: {
            type: Number,
            primary: true,
            generated: true,
        },
        googleSub: {
            type: String,
            unique: true,
        },
        email: {
            type: String,
            unique: true,
        },
        displayName: {
            type: String,
        },
        avatar: {
            type: String,
            nullable: true,
        },
        dietaryPreferences: {
            type: "simple-array",
            nullable: true,
        },
        favoriteCuisines: {
            type: "simple-array",
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
