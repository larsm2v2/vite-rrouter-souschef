import { EntitySchema } from "typeorm";

export interface RecipeActivityLog {
  id: number;
  userId: number;
  recipeId: number;
  activityType: string;
  activityData?: any;
  createdAt?: Date;
}

export const RecipeActivityLogSchema = new EntitySchema<RecipeActivityLog>({
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
