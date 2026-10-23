import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

const url = (path: string) => `${process.env["NEXTJS_SDK_OFFLINE_TEST_URL"]}${path}`;

const $fetch = async (path: string): Promise<string> => {
  const res = await fetch(url(path));
  return res.text();
};

const $fetchJson = async <T>(path: string): Promise<T> => {
  const res = await fetch(url(path));
  return res.json() as Promise<T>;
};

const textOf = (page: Page, selector: string) =>
  expect.poll(async () => (await page.locator(selector).textContent())?.trim(), {
    timeout: 15_000,
  });

const offlineCell = {
  welcomeMessage: "Hello from the offline cell!",
  featureEnabled: false,
  itemCount: 3,
  jsonData: { greeting: "offline", count: 1 },
};

describe("ConfigDirector Next.js SDK — offline cell started from a values file without SDK keys", () => {
  const ssrTextOf = (html: string, testId: string) =>
    html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)</div>`))?.[1]?.trim().replace(/&quot;/g, '"');

  test("renders the file's string value in SSR HTML", async () => {
    const html = await $fetch("/");

    expect(ssrTextOf(html, "welcome")).toBe(offlineCell.welcomeMessage);
  });

  test("renders the file's boolean value in SSR HTML", async () => {
    const html = await $fetch("/");

    expect(ssrTextOf(html, "feature-enabled")).toBe("false");
  });

  test("renders the file's integer value in SSR HTML", async () => {
    const html = await $fetch("/");

    expect(ssrTextOf(html, "item-count")).toBe("3");
  });

  test("renders the file's object value as a parsed object in SSR HTML", async () => {
    const html = await $fetch("/");

    expect(ssrTextOf(html, "json-data")).toBe(JSON.stringify(offlineCell.jsonData));
  });

  test("renders the file's object value as its raw JSON string when the in-code default is a string", async () => {
    const html = await $fetch("/");

    expect(ssrTextOf(html, "json-data-raw")).toBe(JSON.stringify({ greeting: "offline" }));
  });

  test("reports a loading status in SSR HTML", async () => {
    const html = await $fetch("/");

    expect(ssrTextOf(html, "status")).toBe("loading");
  });

  test("serves the file's values from the server singleton to route handlers", async () => {
    const data = await $fetchJson<{
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
    const data = await $fetchJson<{ clientReady: number }>("/api/hook-calls");

    expect(data.clientReady).toBe(1);
  });

  describe("in the browser", () => {
    let browser: Browser;

    beforeAll(async () => {
      browser = await chromium.launch({ headless: true });
    });

    afterAll(async () => {
      await browser?.close();
    });

    test(
      "serves the same values after hydration, becomes ready, and sends no request",
      { timeout: 30_000 },
      async () => {
        const page = await browser.newPage();
        const requestsLeavingTheApp: string[] = [];
        page.on("request", (request) => {
          if (!request.url().startsWith(url("/"))) requestsLeavingTheApp.push(request.url());
        });

        await page.goto(url("/"));

        await textOf(page, '[data-testid="status"]').toBe("ready");
        await textOf(page, '[data-testid="loading"]').toBe("done");
        await textOf(page, '[data-testid="welcome"]').toBe(offlineCell.welcomeMessage);
        await textOf(page, '[data-testid="feature-enabled"]').toBe("false");
        await textOf(page, '[data-testid="item-count"]').toBe("3");
        await textOf(page, '[data-testid="json-data"]').toBe(JSON.stringify(offlineCell.jsonData));
        await page.waitForTimeout(500);
        expect(requestsLeavingTheApp).toEqual([]);

        await page.close();
      },
    );

    test("is ready at once with deferInitialization on, with no context and no request", { timeout: 30_000 }, async () => {
      const browserContext = await browser.newContext();
      await browserContext.addCookies([{ name: "deferInitialization", value: "true", url: url("/") }]);
      const page = await browserContext.newPage();
      const requestsLeavingTheApp: string[] = [];
      page.on("request", (request) => {
        if (!request.url().startsWith(url("/"))) requestsLeavingTheApp.push(request.url());
      });

      await page.goto(url("/"));

      await textOf(page, '[data-testid="status"]').toBe("ready");
      await textOf(page, '[data-testid="welcome"]').toBe(offlineCell.welcomeMessage);
      await page.waitForTimeout(500);
      expect(requestsLeavingTheApp).toEqual([]);

      await browserContext.close();
    });
  });
});
