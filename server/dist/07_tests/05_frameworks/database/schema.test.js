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
describe("Database Schema", () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, schema_1.initializeDatabase)();
    }));
    describe("Users Table", () => {
        it("should enforce unique google_sub constraint", () => __awaiter(void 0, void 0, void 0, function* () {
            const googleSub = `test-unique-${Date.now()}`;
            const client = yield connection_1.default.connect();
            try {
                yield client.query(`INSERT INTO users (google_sub, email, display_name)
           VALUES ($1, $2, $3)`, [googleSub, "test1@example.com", "Test User 1"]);
                yield expect(client.query(`INSERT INTO users (google_sub, email, display_name)
             VALUES ($1, $2, $3)`, [googleSub, "test2@example.com", "Test User 2"])).rejects.toThrow();
                yield client.query("DELETE FROM users WHERE google_sub = $1", [
                    googleSub,
                ]);
            }
            finally {
                client.release();
            }
        }));
        it("should enforce unique email constraint", () => __awaiter(void 0, void 0, void 0, function* () {
            const email = `unique-email-${Date.now()}@example.com`;
            const client = yield connection_1.default.connect();
            try {
                yield client.query(`INSERT INTO users (google_sub, email, display_name)
           VALUES ($1, $2, $3)`, [`sub-${Date.now()}`, email, "User A"]);
                yield expect(client.query(`INSERT INTO users (google_sub, email, display_name)
             VALUES ($1, $2, $3)`, [`sub2-${Date.now()}`, email, "User B"])).rejects.toThrow();
                yield client.query("DELETE FROM users WHERE email = $1", [email]);
            }
            finally {
                client.release();
            }
        }));
    });
    describe("Audit Log Table", () => {
        it("should allow null user_id in audit_log", () => __awaiter(void 0, void 0, void 0, function* () {
            const client = yield connection_1.default.connect();
            try {
                const result = yield client.query(`INSERT INTO audit_log (
            user_id, action, endpoint, ip_address, 
            user_agent, status_code, metadata
          ) VALUES (
            NULL, 'GET', '/test', '127.0.0.1',
            'test-agent', 200, '{"test": true}'
          ) RETURNING id`);
                expect(result.rows[0].id).toBeDefined();
                yield client.query("DELETE FROM audit_log WHERE id = $1", [
                    result.rows[0].id,
                ]);
            }
            finally {
                client.release();
            }
        }));
        it("should enforce action length constraint", () => __awaiter(void 0, void 0, void 0, function* () {
            const longAction = "A".repeat(51); // Exceeds 50 char limit
            const client = yield connection_1.default.connect();
            try {
                yield expect(client.query(`INSERT INTO audit_log (action, endpoint, ip_address)
             VALUES ($1, '/test', '127.0.0.1')`, [longAction])).rejects.toThrow();
            }
            finally {
                client.release();
            }
        }));
        it("should enforce status_code range constraint", () => __awaiter(void 0, void 0, void 0, function* () {
            const client = yield connection_1.default.connect();
            try {
                yield expect(client.query(`INSERT INTO audit_log (action, endpoint, ip_address, status_code)
             VALUES ('GET', '/test', '127.0.0.1', 999)`)).rejects.toThrow();
            }
            finally {
                client.release();
            }
        }));
    });
    describe("Foreign Key Constraints", () => {
        it("should set user_id to NULL when user is deleted", () => __awaiter(void 0, void 0, void 0, function* () {
            // Create user
            const client = yield connection_1.default.connect();
            try {
                const userResult = yield client.query(`INSERT INTO users (google_sub, email, display_name)
           VALUES ($1, $2, $3) RETURNING id`, [`test-fk-${Date.now()}`, `test-fk@example.com`, "FK Test"]);
                const userId = userResult.rows[0].id;
                // Create audit log entry
                const auditResult = yield client.query(`INSERT INTO audit_log (user_id, action, endpoint, ip_address)
           VALUES ($1, 'GET', '/test', '127.0.0.1') RETURNING id`, [userId]);
                const auditId = auditResult.rows[0].id;
                // Delete user
                yield client.query("DELETE FROM users WHERE id = $1", [userId]);
                // Check audit log user_id is now NULL
                const checkResult = yield client.query("SELECT user_id FROM audit_log WHERE id = $1", [auditId]);
                expect(checkResult.rows[0].user_id).toBeNull();
                // Cleanup
                yield client.query("DELETE FROM audit_log WHERE id = $1", [auditId]);
            }
            finally {
                client.release();
            }
        }));
    });
});
