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
exports.migrateAddRefreshTokens = migrateAddRefreshTokens;
const connection_1 = __importDefault(require("../05_frameworks/database/connection"));
function migrateAddRefreshTokens() {
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
            // If migration already applied, skip
            const res = yield client.query(`SELECT 1 FROM schema_version WHERE version = 4 LIMIT 1;`);
            if (res.rows.length > 0) {
                console.log("Migration add_refresh_tokens (v4) already applied, skipping.");
                return;
            }
            yield client.query("BEGIN");
            yield client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        jti TEXT UNIQUE NOT NULL,
        token TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        revoked BOOLEAN DEFAULT FALSE
      );
    `);
            yield client.query(`INSERT INTO schema_version (version) VALUES (4);`);
            yield client.query("COMMIT");
            console.log("Migration add_refresh_tokens (v4) applied successfully.");
        }
        catch (err) {
            yield client.query("ROLLBACK");
            console.error("Migration add_refresh_tokens (v4) failed:", err);
            throw err;
        }
        finally {
            client.release();
        }
    });
}
if (require.main === module) {
    migrateAddRefreshTokens()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
