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
exports.up = up;
exports.down = down;
const connection_1 = __importDefault(require("../05_frameworks/database/connection"));
function up() {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield connection_1.default.connect();
        try {
            yield client.query("BEGIN");
            console.log("Running migration: add_recipe_images_update_grocery_list");
            // Check schema version
            yield client.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);
            const versionCheck = yield client.query("SELECT version FROM schema_version WHERE version = 4");
            if (versionCheck.rows.length > 0) {
                console.log("Migration already applied, skipping...");
                yield client.query("COMMIT");
                return; // Don't release here, let finally block handle it
            }
            // Create recipe_images table
            console.log("Creating recipe_images table...");
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
            // Backup existing grocery_list data
            console.log("Backing up grocery_list data...");
            yield client.query(`
      CREATE TABLE IF NOT EXISTS grocery_list_backup_v3 AS 
      SELECT * FROM grocery_list;
    `);
            // Drop old grocery_list table
            console.log("Dropping old grocery_list table...");
            yield client.query(`DROP TABLE IF EXISTS grocery_list CASCADE;`);
            // Create new grocery_list table with improved structure
            console.log("Creating new grocery_list table with aggregation support...");
            yield client.query(`
      CREATE TABLE grocery_list (
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
            // Record migration
            yield client.query("INSERT INTO schema_version (version) VALUES (4) ON CONFLICT (version) DO NOTHING");
            yield client.query("COMMIT");
            console.log("✅ Migration completed successfully");
        }
        catch (err) {
            yield client.query("ROLLBACK");
            console.error("❌ Migration failed:", err);
            throw err;
        }
        finally {
            client.release();
        }
    });
}
function down() {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield connection_1.default.connect();
        try {
            yield client.query("BEGIN");
            console.log("Rolling back migration: add_recipe_images_update_grocery_list");
            // Drop new tables
            yield client.query(`DROP TABLE IF EXISTS recipe_images CASCADE;`);
            yield client.query(`DROP TABLE IF EXISTS grocery_list CASCADE;`);
            // Restore old grocery_list from backup if it exists
            const backupExists = yield client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'grocery_list_backup_v3'
      );
    `);
            if (backupExists.rows[0].exists) {
                yield client.query(`
        CREATE TABLE grocery_list AS 
        SELECT * FROM grocery_list_backup_v3;
      `);
                yield client.query(`DROP TABLE grocery_list_backup_v3;`);
            }
            // Remove version record
            yield client.query("DELETE FROM schema_version WHERE version = 4");
            yield client.query("COMMIT");
            console.log("✅ Rollback completed successfully");
        }
        catch (err) {
            yield client.query("ROLLBACK");
            console.error("❌ Rollback failed:", err);
            throw err;
        }
        finally {
            client.release();
        }
    });
}
// Auto-run migration if executed directly
if (require.main === module) {
    up()
        .then(() => {
        console.log("Migration completed");
        process.exit(0);
    })
        .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
}
