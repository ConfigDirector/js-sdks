import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import {
  mswSetup,
  mswTeardown,
  mswGetPayloads,
  mswUseHandlers,
  mswUseSseHandler,
  mswWasRequestReceived,
} from "../js-browser-client/test/msw-setup";
import "../js-browser-client/test/vitest-browser-commands.d.ts";

export default defineConfig({
  publicDir: "../../public",
  define: {
    "process.env.NODE_ENV": JSON.stringify("test"),
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    browser: {
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      enabled: true,
      instances: [{ browser: "chromium" }],
      commands: {
        mswSetup,
        mswTeardown,
        mswUseHandlers,
        mswUseSseHandler,
        mswGetPayloads,
        mswWasRequestReceived,
      },
    },
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
    },
  },
});
