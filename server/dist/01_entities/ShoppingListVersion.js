"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroceryListVersionSchema = void 0;
const typeorm_1 = require("typeorm");
exports.GroceryListVersionSchema = new typeorm_1.EntitySchema({
  name: "GroceryListVersion",
  columns: {
    id: { type: Number, primary: true, generated: true },
    userId: { type: Number },
    version: { type: Number },
    listData: { type: "json" },
    createdAt: { type: Date, createDate: true },
    isCurrent: { type: Boolean, default: true },
  },
});
