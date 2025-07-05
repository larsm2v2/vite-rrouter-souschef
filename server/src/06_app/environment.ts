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

  console.log("✅ Environment variables validated successfully.");
}
