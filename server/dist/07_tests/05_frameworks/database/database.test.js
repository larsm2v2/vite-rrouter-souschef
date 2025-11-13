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
const connection_1 = __importDefault(require("../../../05_frameworks/database/connection"));
const schema_1 = require("../../../05_frameworks/database/schema");
describe("Database Framework", () => {
    describe("Connection Pool", () => {
        it("should connect to database successfully", () => __awaiter(void 0, void 0, void 0, function* () {
            const client = yield connection_1.default.connect();
            try {
                const result = yield client.query("SELECT 1 as test");
                expect(result.rows[0].test).toBe(1);
            }
            finally {
                client.release();
            }
        }));
        it("should handle queries with parameters", () => __awaiter(void 0, void 0, void 0, function* () {
            const client = yield connection_1.default.connect();
            try {
                const result = yield client.query("SELECT $1::text as value", ["test"]);
                expect(result.rows[0].value).toBe("test");
            }
            finally {
                client.release();
            }
        }));
    });
    describe("Schema Initialization", () => {
        it("should initialize database schema", () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect((0, schema_1.initializeDatabase)()).resolves.not.toThrow();
        }));
        it("should create all required tables", () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, schema_1.initializeDatabase)();
            const tables = ["users", "recipes", "grocery_list", "audit_log"];
            const client = yield connection_1.default.connect();
            try {
                for (const table of tables) {
                    const result = yield client.query(`SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = $1
            )`, [table]);
                    expect(result.rows[0].exists).toBe(true);
                }
            }
            finally {
                client.release();
            }
        }));
    });
});
