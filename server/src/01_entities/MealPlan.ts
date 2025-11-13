import { EntitySchema } from "typeorm";

export interface MealPlan {
  id: number;
  userId: number;
  recipeId: number;
  plannedDate: Date | string;
  mealType?: string;
  isCooked?: boolean;
  cookedDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const MealPlanSchema = new EntitySchema<MealPlan>({
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
