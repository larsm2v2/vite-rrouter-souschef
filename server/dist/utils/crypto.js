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
    const cipher = crypto_1.default.createCipheriv("aes-256-gcm", Buffer.from(process.env.ENCRYPTION_KEY, "hex"), iv);
    return `${iv.toString("hex")}:${cipher.update(token, "utf8", "hex")}${cipher.final("hex")}:${cipher.getAuthTag().toString("hex")}`;
}
function decryptToken(encrypted) {
    const [ivHex, content, authTag] = encrypted.split(":");
    const decipher = crypto_1.default.createDecipheriv("aes-256-gcm", Buffer.from(process.env.ENCRYPTION_KEY, "hex"), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTag, "hex"));
    return `${decipher.update(content, "hex", "utf8")}${decipher.final("utf8")}`;
}
