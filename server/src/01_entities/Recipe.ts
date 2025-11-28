import { EntitySchema } from "typeorm";

export interface Recipe {
  id: number;
  userId: number;
  uniqueId: number;
  name: string;
  slug: string;
  cuisine?: string;
  mealType?: string;
  dietaryRestrictions?: string[];
  servingInfo?: {
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servings?: number;
  };
  ingredients?: {
    [category: string]: {
      name: string;
      quantity: number;
      unit?: string;
    }[];
  };
  instructions?: {
    stepNumber?: number;
    number?: number;
    instruction?: string;
    text?: string;
  }[];
  notes?: string[];
  images?: {
    imageUrl?: string;
    image_url?: string;
    isPrimary?: boolean;
  }[];
  nutrition?: {
    [key: string]: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export const RecipeSchema = new EntitySchema<Recipe>({
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
