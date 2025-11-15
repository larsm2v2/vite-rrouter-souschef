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
exports.ensureDatabaseInitialized = ensureDatabaseInitialized;
const connection_1 = __importDefault(require("../05_frameworks/database/connection"));
const schema_1 = require("../05_frameworks/database/schema");
/**
 * Ensures the database is connected and initialized.
 * First attempts to connect and verify tables exist.
 * If tables don't exist, runs schema initialization.
 * Throws error if database is unreachable or initialization fails.
 */
function ensureDatabaseInitialized() {
    return __awaiter(this, void 0, void 0, function* () {
        // First verify we can connect to the database
        try {
            yield connection_1.default.query("SELECT 1");
            console.log("✅ Database connection successful");
        }
        catch (error) {
            console.error("❌ Database connection failed:", error);
            throw new Error(`Database unreachable: ${error.message || error}`);
        }
        // Then verify schema is initialized
        try {
            yield connection_1.default.query("SELECT 1 FROM users LIMIT 1");
            console.log("✅ Database schema already initialized");
        }
        catch (error) {
            console.warn("⚠️ Database schema not initialized. Running initializeDatabase()...");
            try {
                yield (0, schema_1.initializeDatabase)();
                console.log("✅ Database schema initialization completed");
            }
            catch (initError) {
                console.error("❌ Database schema initialization failed:", initError);
                throw new Error(`Schema initialization failed: ${initError.message || initError}`);
            }
        }
    });
}
