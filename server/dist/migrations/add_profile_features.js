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
exports.migrateAddProfileFeatures = migrateAddProfileFeatures;
const connection_1 = __importDefault(require("../05_frameworks/database/connection"));
/**
 * Migration: add_profile_features (version 3)
 * - Adds profile-related columns to recipes and users
 * - Creates meal_plan, shopping_list_versions, recipe_activity_log tables
 * - Creates helpful indexes
 *
 * This migration is idempotent and records its application in schema_version.
 */
function migrateAddProfileFeatures() {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield connection_1.default.connect();
        try {
            // Ensure schema_version table exists
            yield client.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id SERIAL PRIMARY KEY,
        version INTEGER NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);
            // Check if this version is already applied
            const res = yield client.query(`SELECT 1 FROM schema_version WHERE version = 3 LIMIT 1;`);
            if (res.rows.length > 0) {
                console.log("Migration add_profile_features (v3) already applied, skipping.");
                return;
            }
            yield client.query("BEGIN");
            // Add columns to recipes
            yield client.query(`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS cooking_dates JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS photo_url TEXT,
      ADD COLUMN IF NOT EXISTS share_token TEXT;
    `);
            // Add columns to users
            yield client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS dietary_preferences TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS favorite_cuisines TEXT[] DEFAULT '{}';
    `);
            // Create meal_plan
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
            yield client.query(`CREATE INDEX IF NOT EXISTS idx_meal_plan_user_date ON meal_plan(user_id, planned_date DESC);`);
            // Create shopping_list_versions
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
            yield client.query(`CREATE INDEX IF NOT EXISTS idx_shopping_list_user_current ON shopping_list_versions(user_id, is_current);`);
            // Create recipe_activity_log
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
            yield client.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_user ON recipe_activity_log(user_id, created_at DESC);`);
            // Insert schema version record
            yield client.query(`INSERT INTO schema_version (version) VALUES (3);`);
            yield client.query("COMMIT");
            console.log("Migration add_profile_features (v3) applied successfully.");
        }
        catch (err) {
            yield client.query("ROLLBACK");
            console.error("Migration add_profile_features (v3) failed:", err);
            throw err;
        }
        finally {
            client.release();
        }
    });
}
// If this file is executed directly, run the migration
if (require.main === module) {
    migrateAddProfileFeatures()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
