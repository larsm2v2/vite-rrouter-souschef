import { EntitySchema } from "typeorm";

export interface GroceryListVersion {
  id: number;
  userId: number;
  version: number;
  listData: any;
  createdAt?: Date;
  isCurrent?: boolean;
}

export const GroceryListVersionSchema = new EntitySchema<GroceryListVersion>({
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
