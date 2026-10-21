import { fileURLToPath } from "node:url";
import { describe, test, expect, afterAll } from "vitest";
import { setup, $fetch, createPage, url } from "@nuxt/test-utils/e2e";
import { startMockSseServer } from "./helpers/mock-sse-server";
import { OFFLINE_VALUES_ROUTE } from "../src/runtime/offline-values-route";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/configdirector", import.meta.url));
const OFFLINE_CELL_FILE = fileURLToPath(new URL("./fixtures/configdirector/flags/offline-cell.json", import.meta.url));

const offlineCell = {
  welcomeMessage: "Hello from the offline cell!",
  featureEnabled: false,
  itemCount: 3,
  jsonData: { greeting: "offline", count: 1 },
};

const ssrTextOf = (html: string, testId: string) =>
  html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)</div>`))?.[1]?.trim().replace(/&quot;/g, '"');

describe("ConfigDirector Nuxt SDK — offline cell started from a values file through environment variables, without SDK keys", async () => {
  const sdkServerDouble = await startMockSseServer();

  await setup({
    rootDir: FIXTURE_DIR,
    browser: true,
    env: {
      NUXT_CONFIGDIRECTOR_CONNECTION_MODE: "offline",
      NUXT_CONFIGDIRECTOR_CONNECTION_FILE: OFFLINE_CELL_FILE,
      NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY: "",
      NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY: "",
      NUXT_CONFIGDIRECTOR_BASE_URL: sdkServerDouble.baseUrl,
      NUXT_PUBLIC_CONFIGDIRECTOR_BASE_URL: sdkServerDouble.baseUrl,
    },
  });

  afterAll(async () => {
    await sdkServerDouble.close();
  });

  test("renders the file's string value in SSR HTML", async () => {
    const html = await $fetch<string>("/");

    expect(ssrTextOf(html, "welcome")).toBe(offlineCell.welcomeMessage);
  });

  test("renders the file's boolean value in SSR HTML", async () => {
    const html = await $fetch<string>("/");

    expect(ssrTextOf(html, "feature-enabled")).toBe("false");
  });

  test("renders the file's integer value in SSR HTML", async () => {
    const html = await $fetch<string>("/");

    expect(ssrTextOf(html, "item-count")).toBe("3");
  });

  test("renders the file's object value as a parsed object in SSR HTML", async () => {
    const html = await $fetch<string>("/");

    expect(ssrTextOf(html, "json-data")).toBe(JSON.stringify(offlineCell.jsonData));
  });

  test("renders the file's object value as its raw JSON string when the in-code default is a string", async () => {
    const html = await $fetch<string>("/");

    expect(ssrTextOf(html, "json-data-raw")).toBe(JSON.stringify({ greeting: "offline" }));
  });

  test("reports a ready status in SSR HTML", async () => {
    const html = await $fetch<string>("/");

    expect(ssrTextOf(html, "status")).toBe("ready");
  });

  test("serves the file's values from the Nitro client to server routes", async () => {
    const data = await $fetch<{
      welcomeMessage: string;
      featureEnabled: boolean;
      itemCount: number;
      jsonData: object;
      nonExistentKey: string;
      isReady: boolean;
    }>("/api/config");

    expect(data.welcomeMessage).toBe(offlineCell.welcomeMessage);
    expect(data.featureEnabled).toBe(false);
    expect(data.itemCount).toBe(3);
    expect(data.jsonData).toEqual(offlineCell.jsonData);
    expect(data.nonExistentKey).toBe("default-value");
    expect(data.isReady).toBe(true);
  });

  test("fires the server clientReady hook once", async () => {
    const data = await $fetch<{ clientReady: number }>("/api/hook-calls");

    expect(data.clientReady).toBe(1);
  });

  test("serves every offline key decoded by config type on the module's route", async () => {
    const values = await $fetch<Record<string, unknown>>(OFFLINE_VALUES_ROUTE);

    expect(values).toEqual({
      "welcome-message": "Hello from the offline cell!",
      "feature-enabled": false,
      "item-count": 3,
      "json-data": { greeting: "offline", count: 1 },
      "json-data-raw": { greeting: "offline" },
    });
  });

  test(
    "serves the same values in the browser after hydration, becomes ready, and sends nothing outside the app",
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
      await textOf('[data-testid="loading"]').toBe("done");
      await textOf('[data-testid="welcome"]').toBe(offlineCell.welcomeMessage);
      await textOf('[data-testid="feature-enabled"]').toBe("false");
      await textOf('[data-testid="item-count"]').toBe("3");
      await textOf('[data-testid="json-data"]').toBe(JSON.stringify(offlineCell.jsonData));
      await page.waitForTimeout(500);
      expect(requestsLeavingTheApp).toEqual([]);

      await page.close();
    },
  );

  test("sends no request to the SDK server from either half", () => {
    expect(sdkServerDouble.requestedPaths).toEqual([]);
  });
});
