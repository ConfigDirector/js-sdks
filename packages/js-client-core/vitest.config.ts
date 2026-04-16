import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import {
  mswSetup,
  mswTeardown,
  mswGetPayloads,
  mswUseHandlers,
  mswUseSseHandler,
  mswWasRequestReceived,
} from "./test/msw-setup";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    browser: {
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      enabled: true,
      instances: [
        { browser: "chromium" },
      ],
      commands: {
        mswSetup,
        mswTeardown,
        mswUseHandlers,
        mswUseSseHandler,
        mswGetPayloads,
        mswWasRequestReceived,
      },
    },
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
    },
  },
});
