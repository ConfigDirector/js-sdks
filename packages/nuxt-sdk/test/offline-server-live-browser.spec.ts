import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";
import { setup, $fetch, createPage, url } from "@nuxt/test-utils/e2e";
import { CLIENT_BUNDLE } from "./helpers/mock-sse-server";
import { OFFLINE_VALUES_ROUTE } from "../src/runtime/offline-values-route";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/configdirector", import.meta.url));
const OFFLINE_CELL_FILE = fileURLToPath(new URL("./fixtures/configdirector/flags/offline-cell.json", import.meta.url));

const ssrTextOf = (html: string, testId: string) =>
  html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)</div>`))?.[1]?.trim();

const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  "access-control-allow-origin": "*",
};

const CORS_PREFLIGHT_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type",
  "access-control-allow-methods": "POST",
};

describe("ConfigDirector Nuxt SDK — browser connecting with its own key while the server runs from a file", async () => {
  await setup({
    rootDir: FIXTURE_DIR,
    browser: true,
    env: {
      NUXT_CONFIGDIRECTOR_CONNECTION_MODE: "offline",
      NUXT_CONFIGDIRECTOR_CONNECTION_FILE: OFFLINE_CELL_FILE,
      NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY: "",
      NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_MODE: "streaming",
    },
  });

  test("renders the server's file values during SSR", async () => {
    const html = await $fetch<string>("/");

    expect(ssrTextOf(html, "welcome")).toBe("Hello from the offline cell!");
  });

  test(
    "serves the values from its own connection in the browser without fetching the server's values",
    { timeout: 30_000 },
    async () => {
      const page = await createPage();
      const offlineValuesRouteRequests: string[] = [];
      page.on("request", (request) => {
        if (request.url().startsWith(url(OFFLINE_VALUES_ROUTE))) offlineValuesRouteRequests.push(request.url());
      });
      await page.route("**/client/sse/v1", async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
          return;
        }
        await route.fulfill({ status: 200, headers: SSE_HEADERS, body: `data: ${JSON.stringify(CLIENT_BUNDLE)}\n\n` });
      });
      await page.route("**/client/telemetry/v1", async (route) => {
        await route.fulfill({ status: 202, headers: { "access-control-allow-origin": "*" } });
      });

      await page.goto(url("/"));

      const textOf = (selector: string) =>
        expect.poll(async () => (await page.locator(selector).textContent())?.trim(), { timeout: 10_000 });
      await textOf('[data-testid="status"]').toBe("ready");
      await textOf('[data-testid="welcome"]').toBe("Hello from ConfigDirector!");
      await textOf('[data-testid="item-count"]').toBe("7");
      expect(offlineValuesRouteRequests).toEqual([]);

      await page.close();
    },
  );
});
