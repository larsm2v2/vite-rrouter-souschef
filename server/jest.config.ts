import type { Config } from "@jest/types";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

const config: Config.InitialOptions = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  globals: {
    "process.env": {
      ...process.env,
      NODE_ENV: "test", // Force test environment
    },
  },
  setupFiles: [
    "dotenv/config", // Loads .env.test automatically
  ],
  moduleFileExtensions: ["ts", "js"],
  setupFilesAfterEnv: ["./jest.setup.ts"],
  globalSetup: "./jest.global-setup.ts",
  globalTeardown: "./jest.global-teardown.ts",
  detectOpenHandles: true,
};

export default config;

