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
const pg_1 = require("pg");
const classicPuzzles_1 = __importDefault(require("../classicPuzzles"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Force use of development environment
process.env.NODE_ENV = 'development';
// Default difficulty key for classic puzzles
const defaultDifficulty = 'classic';
function migrateClassicPuzzles() {
    return __awaiter(this, void 0, void 0, function* () {
        const MIGRATION_VERSION = 1; // migration version to track classic puzzles population
        const mainPool = new pg_1.Pool({
            user: process.env.PG_USER || "postgres",
            host: process.env.PG_HOST || "localhost",
            database: process.env.PG_DATABASE || "TTLO",
            password: process.env.PG_PASSWORD || "your_password",
            port: parseInt(process.env.PG_PORT || "5432"),
        });
        console.log("Connecting to TTLO database...");
        const client = yield mainPool.connect();
        try {
            // Check if this migration has already been applied
            console.log("Checking schema_version for Classic puzzles migration...");
            const { rows } = yield client.query(`SELECT 1 FROM schema_version WHERE version = $1`, [MIGRATION_VERSION]);
            if (rows.length > 0) {
                console.log("Classic puzzles migration already applied, skipping.");
                return;
            }
            // Check existing entries in classic_puzzles
            const rowsLevels = yield client.query(`SELECT level FROM classic_puzzles WHERE difficulty = $1 ORDER BY level`, [defaultDifficulty]);
            const existingLevels = rowsLevels.rows.map(r => r.level);
            let puzzlesToInsert;
            if (existingLevels.length > 0) {
                // Verify first 25 levels are present
                const missing = [];
                for (let i = 1; i <= 25; i++) {
                    if (!existingLevels.includes(i))
                        missing.push(i);
                }
                if (missing.length === 0) {
                    console.log("First 25 levels exist, inserting levels 26-50...");
                    puzzlesToInsert = Object.values(classicPuzzles_1.default).filter(p => p.level > 25);
                }
                else {
                    console.error(`Missing classic levels: ${missing.join(', ')}. Aborting.`);
                    yield client.query('ROLLBACK');
                    return;
                }
            }
            else {
                console.log("No existing puzzles found, inserting all 50 levels...");
                puzzlesToInsert = Object.values(classicPuzzles_1.default);
            }
            // Insert puzzles based on existing entries
            console.log(`Inserting ${puzzlesToInsert.length} puzzle levels...`);
            for (const { level, pattern, minMoves, gridSize } of puzzlesToInsert) {
                yield client.query(`INSERT INTO classic_puzzles (difficulty, level, pattern, min_moves, grid_size) VALUES ($1, $2, $3, $4, $5)`, [defaultDifficulty, level, pattern, minMoves, gridSize]);
                console.log(`Inserted level ${level} with ${pattern.length} cells`);
            }
            // Record the migration version so we only populate once
            console.log("Recording migration version...");
            yield client.query(`INSERT INTO schema_version (version) VALUES ($1)`, [MIGRATION_VERSION]);
            yield client.query('COMMIT');
            console.log(`Successfully populated classic_puzzles table with ${puzzlesToInsert.length} Classic patterns`);
        }
        catch (err) {
            yield client.query('ROLLBACK');
            console.error('Error during Classic puzzles migration:', err);
            throw err;
        }
        finally {
            client.release();
            yield mainPool.end();
        }
    });
}
// Run the migration if this script is executed directly
if (require.main === module) {
    migrateClassicPuzzles()
        .then(() => {
        console.log('Classic puzzles migration completed successfully');
        process.exit(0);
    })
        .catch(err => {
        console.error('Classic puzzles migration failed:', err);
        process.exit(1);
    });
}
exports.default = migrateClassicPuzzles;
