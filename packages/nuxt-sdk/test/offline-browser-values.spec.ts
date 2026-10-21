import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";
import { setup, $fetch, createPage, url } from "@nuxt/test-utils/e2e";
import { OFFLINE_VALUES_ROUTE } from "../src/runtime/offline-values-route";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/configdirector", import.meta.url));
const OFFLINE_CELL_FILE = fileURLToPath(new URL("./fixtures/configdirector/flags/offline-cell.json", import.meta.url));

const ssrTextOf = (html: string, testId: string) =>
  html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)</div>`))?.[1]?.trim();

describe("ConfigDirector Nuxt SDK — browser given its own offline values while the server runs from a file", async () => {
  await setup({
    rootDir: FIXTURE_DIR,
    browser: true,
    nuxtConfig: {
      runtimeConfig: {
        public: {
          configdirector: {
            connection: { mode: "offline", values: { "welcome-message": "Hello from the browser's own values!", "item-count": 11 } },
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

  test("renders the server's file values during SSR", async () => {
    const html = await $fetch<string>("/");

    expect(ssrTextOf(html, "welcome")).toBe("Hello from the offline cell!");
    expect(ssrTextOf(html, "item-count")).toBe("3");
  });

  test(
    "serves the public values in the browser without fetching the server's values or sending anything outside the app",
    { timeout: 30_000 },
    async () => {
      const page = await createPage();
      const requestsLeavingTheApp: string[] = [];
      const offlineValuesRouteRequests: string[] = [];
      page.on("request", (request) => {
        if (!request.url().startsWith(url("/"))) requestsLeavingTheApp.push(request.url());
        if (request.url().startsWith(url(OFFLINE_VALUES_ROUTE))) offlineValuesRouteRequests.push(request.url());
      });

      await page.goto(url("/"));

      const textOf = (selector: string) =>
        expect.poll(async () => (await page.locator(selector).textContent())?.trim(), { timeout: 10_000 });
      await textOf('[data-testid="status"]').toBe("ready");
      await textOf('[data-testid="welcome"]').toBe("Hello from the browser's own values!");
      await textOf('[data-testid="item-count"]').toBe("11");
      await textOf('[data-testid="feature-enabled"]').toBe("false");
      await page.waitForTimeout(500);
      expect(offlineValuesRouteRequests).toEqual([]);
      expect(requestsLeavingTheApp).toEqual([]);

      await page.close();
    },
  );
});
