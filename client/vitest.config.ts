import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so the app build does not depend on vitest's types.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
