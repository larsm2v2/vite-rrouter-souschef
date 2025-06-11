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
const database_1 = __importDefault(require("../config/database"));
/**
 * Migration script to update difficulty values for classic puzzles
 */
// Force use of the production environment values
process.env.NODE_ENV = 'development';
function updateDifficulties() {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield database_1.default.connect();
        try {
            console.log("Starting difficulty update process...");
            yield client.query('BEGIN');
            // First check if classic_puzzles table exists
            const { rows: tableCheck } = yield client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'classic_puzzles'
      );
    `);
            if (!tableCheck[0].exists) {
                console.log("classic_puzzles table doesn't exist, nothing to update");
                yield client.query('ROLLBACK');
                return;
            }
            // Since difficulty is NOT NULL, we need to update to empty string instead of NULL
            console.log("Updating difficulty values for classic puzzles...");
            const { rowCount } = yield client.query(`
      UPDATE classic_puzzles
      SET difficulty = ''
      WHERE difficulty = 'classic'
    `);
            console.log(`Updated difficulty for ${rowCount} puzzles from 'classic' to empty string`);
            yield client.query('COMMIT');
            console.log("Difficulty update completed successfully");
        }
        catch (err) {
            yield client.query('ROLLBACK');
            console.error('Error updating difficulties:', err);
            throw err;
        }
        finally {
            client.release();
        }
    });
}
// Run the migration if this script is executed directly
if (require.main === module) {
    updateDifficulties()
        .then(() => {
        console.log('Difficulty update completed successfully');
        process.exit(0);
    })
        .catch(err => {
        console.error('Difficulty update failed:', err);
        process.exit(1);
    });
}
exports.default = updateDifficulties;
