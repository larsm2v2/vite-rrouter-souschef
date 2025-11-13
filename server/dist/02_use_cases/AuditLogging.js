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
exports.LogAudit = void 0;
const connection_1 = __importDefault(require("../05_frameworks/database/connection"));
class LogAudit {
    execute(_a) {
        return __awaiter(this, arguments, void 0, function* ({ userId, action, endpoint, ipAddress, userAgent, statusCode, metadata, }) {
            yield connection_1.default.query(`INSERT INTO audit_log (
        user_id, action, endpoint, ip_address, 
        user_agent, status_code, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                userId || null,
                action,
                endpoint,
                ipAddress,
                userAgent,
                statusCode,
                JSON.stringify(metadata),
            ]);
        });
    }
}
exports.LogAudit = LogAudit;
