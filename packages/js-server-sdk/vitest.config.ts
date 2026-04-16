import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: { target: ["es2020"] },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
  optimizeDeps: {
    include: ["@jsonjoy.com/json-pointer", "rapidhash-js", "semver"],
  },
});
