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
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateRecipeTables = migrateRecipeTables;
const __1 = require("..");
const add_profile_features_1 = require("../../../migrations/add_profile_features");
const add_refresh_tokens_1 = require("../../../migrations/add_refresh_tokens");
function migrateRecipeTables() {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield __1.pool.connect();
        try {
            yield client.query("BEGIN");
            // Existing migrations may run here. Call profile features migration as part of migration runner.
            yield (0, add_profile_features_1.migrateAddProfileFeatures)();
            // Ensure refresh token allowlist table exists. This migration is idempotent.
            yield (0, add_refresh_tokens_1.migrateAddRefreshTokens)();
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
exports.default = migrateRecipeTables;
