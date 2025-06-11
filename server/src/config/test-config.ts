import { Pool } from "pg";
import dotenv from "dotenv";

// Load test environment variables
dotenv.config({ path: ".env.test" });

export const testPool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: parseInt(process.env.PG_PORT || "5432"),
}); 