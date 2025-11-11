import type { Config } from "@jest/types";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

const config: Config.InitialOptions = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts", "**/07_tests/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  testPathIgnorePatterns: [
    "\\\
    /node_modules/",
    "/src/archive/",
  ],
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
  // Use a simple JS global teardown to close the DB pool across test suites
  globalTeardown: "./src/testTeardown.js",
  detectOpenHandles: true,
  testTimeout: 30000,
  forceExit: true,
};

export default config;
