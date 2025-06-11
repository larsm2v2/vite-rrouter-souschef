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
describe('Database Schema', () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Drop tables in correct order to handle dependencies
        yield database_1.default.query('DROP TABLE IF EXISTS audit_log');
        yield database_1.default.query('DROP TABLE IF EXISTS game_stats');
        yield database_1.default.query('DROP TABLE IF EXISTS users');
        // Create tables in correct order
        yield database_1.default.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_sub TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL
      );
    `);
        yield database_1.default.query(`
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
    }));
    it('should allow null user_id in audit_log', () => __awaiter(void 0, void 0, void 0, function* () {
        // Test inserting a record with null user_id
        const result = yield database_1.default.query(`
      INSERT INTO audit_log (
        user_id, action, endpoint, ip_address, 
        user_agent, status_code, metadata
      ) VALUES (
        NULL, 'GET', '/test', '127.0.0.1',
        'test-agent', 200, '{"test": true}'
      ) RETURNING id;
    `);
        expect(result.rows[0].id).toBeDefined();
        // Clean up
        yield database_1.default.query('DELETE FROM audit_log WHERE id = $1', [result.rows[0].id]);
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Drop tables in correct order
        yield database_1.default.query('DROP TABLE IF EXISTS audit_log');
        yield database_1.default.query('DROP TABLE IF EXISTS users');
        yield database_1.default.end();
    }));
});
