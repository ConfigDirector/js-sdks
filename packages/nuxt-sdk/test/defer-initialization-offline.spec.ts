import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";
import { setup, createPage, url } from "@nuxt/test-utils/e2e";
import { textOf } from "./helpers/browser-page";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/configdirector", import.meta.url));
const OFFLINE_CELL_FILE = fileURLToPath(new URL("./fixtures/configdirector/flags/offline-cell.json", import.meta.url));

describe("ConfigDirector Nuxt SDK — deferInitialization while the browser runs in offline mode", async () => {
  await setup({
    rootDir: FIXTURE_DIR,
    browser: true,
    nuxtConfig: {
      runtimeConfig: {
        public: {
          configdirector: {
            connection: { mode: "offline", values: { "welcome-message": "Hello from the browser's own values!", "item-count": 11 } },
            deferInitialization: true,
          },
        },
      },
    },
    env: {
      NUXT_CONFIGDIRECTOR_CONNECTION_MODE: "offline",
      NUXT_CONFIGDIRECTOR_CONNECTION_FILE: OFFLINE_CELL_FILE,
      NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY: "",
      NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY: "",
    },
  });

  test("is ready at once with the offline values, without a context and without a connection", { timeout: 30_000 }, async () => {
    const page = await createPage();
    const requestsLeavingTheApp: string[] = [];
    page.on("request", (request) => {
      if (!request.url().startsWith(url("/"))) requestsLeavingTheApp.push(request.url());
    });

    await page.goto(url("/context-test"));

    await textOf(page, "status").toBe("ready");
    await textOf(page, "welcome").toBe("Hello from the browser's own values!");
    await textOf(page, "context-id").toBe("none");
    await page.waitForTimeout(500);
    expect(requestsLeavingTheApp).toEqual([]);

    await page.close();
  });
});
