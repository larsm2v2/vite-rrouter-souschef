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
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
const crypto_1 = __importDefault(require("crypto"));
function hashPassword(password) {
    return __awaiter(this, void 0, void 0, function* () {
        const salt = crypto_1.default.randomBytes(16).toString("hex");
        const hash = yield pbkdf2Hash(password, salt);
        return { hash, salt };
    });
}
function comparePassword(password, storedHash, salt) {
    return __awaiter(this, void 0, void 0, function* () {
        const hash = yield pbkdf2Hash(password, salt);
        return crypto_1.default.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
    });
}
function pbkdf2Hash(password, salt) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            crypto_1.default.pbkdf2(password, salt, 100000, 64, "sha512", (err, derivedKey) => {
                if (err)
                    reject(err);
                resolve(derivedKey.toString("hex"));
            });
        });
    });
}
