"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateRecipeTables = migrateRecipeTables;
exports.updateRecipeTables = updateRecipeTables;
const connection_1 = __importDefault(require("../05_frameworks/database/connection"));
function migrateRecipeTables() {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield connection_1.default.connect();
        try {
            yield client.query("BEGIN");
            // Check if schema_version table exists
            const schemaVersionResult = yield client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_version'
      );
    `);
            if (!schemaVersionResult.rows[0].exists) {
                console.log("Creating schema_version table...");
                yield client.query(`
        CREATE TABLE schema_version (
          version INT PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT NOW()
        );
      `);
            }
            // Check if recipe tables migration has been applied
            const versionResult = yield client.query(`
      SELECT EXISTS (
        SELECT FROM schema_version 
        WHERE version = 2
      );
    `);
            if (versionResult.rows[0].exists) {
                console.log("Recipe tables migration already applied. Skipping.");
                yield client.query("COMMIT");
                return;
            }
            console.log("Creating recipe tables...");
            // Create tables using the schema we defined
            yield client.query(`
      -- Main recipes table
      CREATE TABLE IF NOT EXISTS recipes (
          id SERIAL PRIMARY KEY,
          unique_id BIGINT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          cuisine TEXT,
          meal_type TEXT,
          dietary_restrictions TEXT[],
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Serving information
      CREATE TABLE IF NOT EXISTS recipe_serving_info (
          recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
          prep_time TEXT,
          cook_time TEXT,
          total_time TEXT,
          servings INTEGER,
          PRIMARY KEY (recipe_id)
      );
      
      -- Ingredients stored as JSONB for flexibility
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
          recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          ingredients JSONB NOT NULL,
          PRIMARY KEY (recipe_id, category)
      );
      
      -- Instructions as ordered steps
      CREATE TABLE IF NOT EXISTS recipe_instructions (
          recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
          step_number INTEGER NOT NULL,
          instruction TEXT NOT NULL,
          PRIMARY KEY (recipe_id, step_number)
      );
      
      -- Notes table
      CREATE TABLE IF NOT EXISTS recipe_notes (
          id SERIAL PRIMARY KEY,
          recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
          note TEXT NOT NULL
      );
      
      -- Nutrition information as JSONB
      CREATE TABLE IF NOT EXISTS recipe_nutrition (
          recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
          nutrition_data JSONB NOT NULL,
          PRIMARY KEY (recipe_id)
      );
      
      -- Create indexes for performance
      CREATE INDEX idx_recipes_cuisine ON recipes(cuisine);
      CREATE INDEX idx_recipes_meal_type ON recipes(meal_type);
      CREATE INDEX idx_recipes_dietary ON recipes USING GIN(dietary_restrictions);
    `);
            // Record that this migration has been applied
            yield client.query(`
      INSERT INTO schema_version (version) VALUES (2);
    `);
            yield client.query("COMMIT");
            console.log("✅ Recipe tables created successfully");
        }
        catch (err) {
            yield client.query("ROLLBACK");
            console.error("❌ Error creating recipe tables:", err);
            throw err;
        }
        finally {
            client.release();
        }
    });
}
function updateRecipeTables() {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield connection_1.default.connect();
        try {
            yield client.query("BEGIN");
            // Add user_id to recipes table
            yield client.query(`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    `);
            // Add recipe_id to grocery_list table
            yield client.query(`
      ALTER TABLE grocery_list
      ADD COLUMN IF NOT EXISTS recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE;
    `);
            // Create composite indexes
            yield client.query(`
      CREATE INDEX IF NOT EXISTS idx_grocery_list_user_recipe ON grocery_list(user_id, recipe_id);
      CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
    `);
            yield client.query("COMMIT");
            console.log("✅ Recipe tables updated successfully");
        }
        catch (err) {
            yield client.query("ROLLBACK");
            console.error("❌ Error updating recipe tables:", err);
            throw err;
        }
        finally {
            client.release();
        }
    });
}
exports.default = migrateRecipeTables;
