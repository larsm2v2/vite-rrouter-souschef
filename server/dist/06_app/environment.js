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
    console.log("✅ Environment variables validated successfully.");
}
