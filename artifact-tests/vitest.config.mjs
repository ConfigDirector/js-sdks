import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.mjs"],
    testTimeout: 180_000,
    hookTimeout: 300_000,
  },
});
