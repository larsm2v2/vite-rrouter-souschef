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
exports.revokeRefreshTokenByJti = exports.isRefreshTokenValid = exports.verifyToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const connection_1 = __importDefault(require("../05_frameworks/database/connection"));
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-me";
const ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || "15m";
const REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || "7d";
const generateAccessToken = (userId, email, displayName) => {
    return jsonwebtoken_1.default.sign({
        sub: String(userId),
        email,
        display_name: displayName,
        type: "access",
    }, JWT_SECRET, { expiresIn: ACCESS_EXPIRATION });
};
exports.generateAccessToken = generateAccessToken;
// Generate a refresh token and persist it to the database (allowlist)
const generateRefreshToken = (userId, email, displayName) => __awaiter(void 0, void 0, void 0, function* () {
    const jti = (0, crypto_1.randomUUID)();
    const token = jsonwebtoken_1.default.sign({
        sub: String(userId),
        email,
        display_name: displayName,
        type: "refresh",
        jti,
    }, JWT_SECRET, { expiresIn: REFRESH_EXPIRATION });
    // Decode token to get exp claim (seconds since epoch)
    const decoded = jsonwebtoken_1.default.decode(token);
    const exp = (decoded === null || decoded === void 0 ? void 0 : decoded.exp) || null; // exp is in seconds
    try {
        yield connection_1.default.query(`INSERT INTO refresh_tokens (jti, token, user_id, expires_at) VALUES ($1, $2, $3, to_timestamp($4))`, [jti, token, userId, exp]);
    }
    catch (err) {
        console.error("Failed to persist refresh token:", err);
        // Note: We don't throw here to avoid breaking login flow; operators should monitor failures.
    }
    return token;
});
exports.generateRefreshToken = generateRefreshToken;
const verifyToken = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (error) {
        console.error("Token verification failed:", error);
        return null;
    }
};
exports.verifyToken = verifyToken;
const isRefreshTokenValid = (token) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = (0, exports.verifyToken)(token);
    if (!payload || payload.type !== "refresh" || !payload.jti) {
        return { valid: false };
    }
    try {
        const res = yield connection_1.default.query(`SELECT 1 FROM refresh_tokens WHERE jti = $1 AND token = $2 AND revoked = false AND expires_at > NOW() LIMIT 1`, [payload.jti, token]);
        return { valid: res.rows.length > 0, payload };
    }
    catch (err) {
        console.error("Error checking refresh token validity:", err);
        return { valid: false };
    }
});
exports.isRefreshTokenValid = isRefreshTokenValid;
const revokeRefreshTokenByJti = (jti) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield connection_1.default.query(`UPDATE refresh_tokens SET revoked = true WHERE jti = $1`, [jti]);
    }
    catch (err) {
        console.error("Failed to revoke refresh token:", err);
    }
});
exports.revokeRefreshTokenByJti = revokeRefreshTokenByJti;
