// src/types/entities/User.ts
import { EntitySchema } from "typeorm";

export interface User {
  id: number;
  googleSub?: string;
  email: string;
  display_name: string;
  avatar?: string;
}

export const UserSchema = new EntitySchema<User>({
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

export interface GameStats {
  id: number;
  current_level: number;
  best_combination: string;
  saved_maps: string;
}
