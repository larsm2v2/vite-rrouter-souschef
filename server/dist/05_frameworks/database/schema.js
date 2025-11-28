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
exports.initializeDatabase = initializeDatabase;
// src/05_frameworks/database/schema.ts
const connection_1 = __importDefault(require("./connection"));
let isInitializing = false;
let initializationPromise = null;
function createTables() {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield connection_1.default.connect();
        try {
            yield client.query("BEGIN");
            // Users table
            yield client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_sub TEXT UNIQUE,
        email TEXT NOT NULL UNIQUE CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'),
        username TEXT UNIQUE,
        password TEXT,
        password_salt TEXT,
        display_name TEXT NOT NULL,
        avatar TEXT,
        google_access_token TEXT,
        google_refresh_token TEXT,
        token_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
            // Recipes table
            yield client.query(`
      CREATE TABLE IF NOT EXISTS recipes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        unique_id BIGINT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        cuisine TEXT,
        meal_type TEXT,
        dietary_restrictions TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
            // Recipe-related tables
            yield client.query(`
      CREATE TABLE IF NOT EXISTS recipe_serving_info (
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        prep_time TEXT,
        cook_time TEXT,
        total_time TEXT,
        servings INTEGER,
        PRIMARY KEY (recipe_id)
      );
    `);
            yield client.query(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        ingredients JSONB NOT NULL,
        PRIMARY KEY (recipe_id, category)
      );
    `);
            yield client.query(`
      CREATE TABLE IF NOT EXISTS recipe_instructions (
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        instruction TEXT NOT NULL,
        PRIMARY KEY (recipe_id, step_number)
      );
    `);
            yield client.query(`
      CREATE TABLE IF NOT EXISTS recipe_notes (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        note TEXT NOT NULL
      );
    `);
            yield client.query(`
      CREATE TABLE IF NOT EXISTS recipe_nutrition (
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        nutrition_data JSONB NOT NULL,
        PRIMARY KEY (recipe_id)
      );
    `);
            yield client.query(`
      CREATE TABLE IF NOT EXISTS recipe_images (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
            yield client.query(`
      CREATE INDEX IF NOT EXISTS idx_recipe_images_recipe ON recipe_images(recipe_id);
    `);
            yield client.query(`
      CREATE TABLE IF NOT EXISTS grocery_list (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_name TEXT NOT NULL,
        category TEXT,
        total_quantity DECIMAL(10,2),
        unit TEXT,
        is_checked BOOLEAN DEFAULT FALSE,
        recipe_sources JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, item_name)
      );
    `);
            yield client.query(`
      CREATE INDEX IF NOT EXISTS idx_grocery_list_user ON grocery_list(user_id, is_checked);
    `);
            // Add profile-related columns to recipes and users if they don't exist
            yield client.query(`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS cooking_dates JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS photo_url TEXT,
      ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
    `);
            yield client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS dietary_preferences TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS favorite_cuisines TEXT[] DEFAULT '{}';
    `);
            // Meal plan table for scheduling
            yield client.query(`
      CREATE TABLE IF NOT EXISTS meal_plan (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        planned_date DATE NOT NULL,
        meal_type TEXT,
        is_cooked BOOLEAN DEFAULT false,
        cooked_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
            yield client.query(`
      CREATE INDEX IF NOT EXISTS idx_meal_plan_user_date ON meal_plan(user_id, planned_date DESC);
    `);
            // Shopping list versions with version history
            yield client.query(`
      CREATE TABLE IF NOT EXISTS shopping_list_versions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        list_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        is_current BOOLEAN DEFAULT true
      );
    `);
            yield client.query(`
      CREATE INDEX IF NOT EXISTS idx_shopping_list_user_current ON shopping_list_versions(user_id, is_current);
    `);
            // Recipe activity log
            yield client.query(`
      CREATE TABLE IF NOT EXISTS recipe_activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        activity_type TEXT NOT NULL,
        activity_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
            yield client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_log_user ON recipe_activity_log(user_id, created_at DESC);
    `);
            yield client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL CHECK (length(action) <= 50),
        endpoint TEXT NOT NULL CHECK (length(endpoint) <= 255),
        ip_address TEXT NOT NULL CHECK (length(ip_address) <= 45),
        user_agent TEXT CHECK (length(user_agent) <= 512),
        status_code INTEGER CHECK (status_code BETWEEN 100 AND 599),
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
            yield client.query("COMMIT");
            console.log("✅ Tables created successfully");
        }
        catch (err) {
            yield client.query("ROLLBACK");
            console.error("❌ Error creating tables:", err);
            throw err;
        }
        finally {
            client.release();
        }
    });
}
function initializeDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (isInitializing) {
                return initializationPromise;
            }
            isInitializing = true;
            initializationPromise = createTables()
                .catch((err) => {
                console.error("Database initialization error:", err);
                throw err;
            })
                .finally(() => {
                isInitializing = false;
            });
            yield initializationPromise;
            console.log("✅ Database schema initialization completed successfully");
        }
        catch (error) {
            console.error("❌ Error initializing database schema:", error);
            throw error;
        }
    });
}
exports.default = initializeDatabase;
