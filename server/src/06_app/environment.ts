import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
  "SESSION_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
  "CLIENT_URL",
  "API_KEY",
];

export function validateEnvironment() {
  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      throw new Error(`${varName} is not defined in .env`);
    }
  });

  // Missing encryption key silently breaks OAuth token encryption/decryption.
  // In production this must be a hard failure -- fail fast at boot rather
  // than letting every OAuth token operation fail unpredictably at runtime.
  if (!process.env.ENCRYPTION_KEY && !process.env.DB_ENCRYPTION_KEY) {
    const message =
      "Missing encryption key — OAuth tokens will fail unless ENCRYPTION_KEY or DB_ENCRYPTION_KEY is set";
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    console.error(`⚠️ ${message}`);
  }

  console.log("✅ Environment variables validated successfully.");
}
