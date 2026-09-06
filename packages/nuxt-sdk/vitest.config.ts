import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packagesDir = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@js-client-core": `${packagesDir}js-client-core/src`,
      "@js-browser-client": `${packagesDir}js-browser-client/src`,
      "@js-server-sdk": `${packagesDir}js-server-sdk/src`,
      "@shared": `${packagesDir}shared/src`,
      "@eventsource": `${packagesDir}eventsource/src`,
      "@config-evaluator": `${packagesDir}config-evaluator/src`,
    },
  },
  test: {
    globalSetup: ["./test/global-setup.ts"],
  },
});
