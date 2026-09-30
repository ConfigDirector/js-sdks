import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@configdirector/nextjs-sdk/client": new URL("./src/client/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    globalSetup: ["./test/global-setup.ts"],
  },
});
