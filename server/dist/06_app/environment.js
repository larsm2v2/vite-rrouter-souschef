"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvironment = validateEnvironment;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const requiredEnvVars = [
    "SESSION_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
    "CLIENT_URL",
    "API_KEY",
];
function validateEnvironment() {
    requiredEnvVars.forEach((varName) => {
        if (!process.env[varName]) {
            throw new Error(`${varName} is not defined in .env`);
        }
    });
    // Warn if no encryption key is present - this will break token storage
    if (!process.env.ENCRYPTION_KEY && !process.env.DB_ENCRYPTION_KEY) {
        console.error("⚠️ Missing encryption key — OAuth tokens will fail unless ENCRYPTION_KEY or DB_ENCRYPTION_KEY is set");
    }
    console.log("✅ Environment variables validated successfully.");
}
