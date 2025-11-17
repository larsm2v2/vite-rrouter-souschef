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
const schema_1 = require("../../../05_frameworks/database/schema");
const migrations_1 = __importDefault(require("../../../05_frameworks/database/migrations/migrations"));
const connection_1 = __importDefault(require("../../../05_frameworks/database/connection"));
describe("Database migrations runner", () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Ensure base schema exists
        yield (0, schema_1.initializeDatabase)();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Clean up - drop table if it exists
        try {
            yield connection_1.default.query("DROP TABLE IF EXISTS refresh_tokens");
        }
        catch (err) {
            // ignore
        }
        yield connection_1.default.end();
    }));
    it("applies refresh token migration", () => __awaiter(void 0, void 0, void 0, function* () {
        // Run migration runner (idempotent)
        yield (0, migrations_1.default)();
        // Verify the table exists
        const res = yield connection_1.default.query("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='refresh_tokens') as exists");
        expect(res.rows[0].exists).toBe(true);
    }), 15000);
});
