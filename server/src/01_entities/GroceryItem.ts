import { EntitySchema } from "typeorm";

export interface GroceryItem {
  id: number;
  userId: number;
  recipeId?: number;
  itemName: string;
  quantity: number;
  unit?: string;
  isChecked?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const GrocerySchema = new EntitySchema<GroceryItem>({
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
