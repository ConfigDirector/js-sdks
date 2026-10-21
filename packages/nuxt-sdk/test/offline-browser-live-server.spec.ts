import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";
import { setup, $fetch, fetch, createPage, url } from "@nuxt/test-utils/e2e";
import { OFFLINE_VALUES_ROUTE } from "../src/runtime/offline-values-route";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/configdirector", import.meta.url));

const ssrTextOf = (html: string, testId: string) =>
  html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)</div>`))?.[1]?.trim();

describe("ConfigDirector Nuxt SDK — browser in offline mode while the server connects to ConfigDirector", async () => {
  await setup({
    rootDir: FIXTURE_DIR,
    browser: true,
    env: {
      NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_MODE: "offline",
      NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY: "",
    },
  });

  test("renders the values from ConfigDirector during SSR", async () => {
    const html = await $fetch<string>("/");

    expect(ssrTextOf(html, "welcome")).toBe("Hello from ConfigDirector!");
  });

  test("does not serve the offline values route", async () => {
    const response = await fetch(OFFLINE_VALUES_ROUTE);

    expect(response.status).toBe(404);
  });

  test(
    "serves the in-code default values in the browser, becomes ready, and opens no connection",
    { timeout: 30_000 },
    async () => {
      const page = await createPage();
      const requestsLeavingTheApp: string[] = [];
      page.on("request", (request) => {
        if (!request.url().startsWith(url("/"))) requestsLeavingTheApp.push(request.url());
      });

      await page.goto(url("/"));

      const textOf = (selector: string) =>
        expect.poll(async () => (await page.locator(selector).textContent())?.trim(), { timeout: 10_000 });
      await textOf('[data-testid="status"]').toBe("ready");
      await textOf('[data-testid="welcome"]').toBe("default-message");
      await textOf('[data-testid="item-count"]').toBe("0");
      await page.waitForTimeout(500);
      expect(requestsLeavingTheApp).toEqual([]);

      await page.close();
    },
  );
});
