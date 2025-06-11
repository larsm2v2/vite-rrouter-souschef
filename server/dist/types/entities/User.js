"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSchema = void 0;
// src/types/entities/User.ts
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
        display_name: {
            type: String,
        },
        avatar: {
            type: String,
            nullable: true,
        },
    },
});
