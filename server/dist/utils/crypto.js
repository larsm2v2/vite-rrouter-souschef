"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
// src/utils/crypto.ts
const crypto_1 = __importDefault(require("crypto"));
function encryptToken(token) {
    const iv = crypto_1.default.randomBytes(12); // 96-bit IV for AES-GCM
    const envKey = process.env.ENCRYPTION_KEY || process.env.DB_ENCRYPTION_KEY;
    if (!envKey) {
        throw new Error("Missing encryption key: set ENCRYPTION_KEY or DB_ENCRYPTION_KEY in environment");
    }
    const cipher = crypto_1.default.createCipheriv("aes-256-gcm", Buffer.from(envKey, "hex"), iv);
    return `${iv.toString("hex")}:${cipher.update(token, "utf8", "hex")}${cipher.final("hex")}:${cipher.getAuthTag().toString("hex")}`;
}
function decryptToken(encrypted) {
    const [ivHex, content, authTag] = encrypted.split(":");
    const envKey = process.env.ENCRYPTION_KEY || process.env.DB_ENCRYPTION_KEY;
    if (!envKey) {
        throw new Error("Missing encryption key: set ENCRYPTION_KEY or DB_ENCRYPTION_KEY in environment");
    }
    const decipher = crypto_1.default.createDecipheriv("aes-256-gcm", Buffer.from(envKey, "hex"), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTag, "hex"));
    return `${decipher.update(content, "hex", "utf8")}${decipher.final("utf8")}`;
}
