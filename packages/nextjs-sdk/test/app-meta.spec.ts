import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { CLIENT_BUNDLE } from "./helpers/mock-sse-server";

const url = (path: string) => `${process.env["NEXTJS_SDK_TEST_URL"]}${path}`;

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

const sseBody = (bundle: object) => `data: ${JSON.stringify(bundle)}\n\n`;

describe("ConfigDirector Next.js SDK — appName/appVersion forwarding", () => {
  describe("register() stores metadata accessible via getAppMeta()", () => {
    it("returns the appName and appVersion set in register()", async () => {
      const res = await fetch(url("/api/app-meta"));
      const data = await res.json();
      expect(data).toMatchObject({ appName: "test-app", appVersion: "1.2.3" });
    });
  });

  describe("server ConfigDirectorProvider forwards metadata to the client provider", () => {
    let browser: Browser;

    beforeAll(async () => {
      browser = await chromium.launch({ headless: true });
    });

    afterAll(async () => {
      await browser?.close();
    });

    it(
      "includes appName and appVersion in the SSE connection request metaContext",
      { timeout: 30_000 },
      async () => {
        const page = await browser.newPage();
        let capturedMetaContext: Record<string, unknown> | undefined;

        await page.route("**/client/sse/v1", async (route) => {
          if (route.request().method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
            return;
          }
          const rawBody = route.request().postData();
          if (rawBody) {
            const parsed = JSON.parse(rawBody) as { metaContext?: Record<string, unknown> };
            capturedMetaContext = parsed.metaContext;
          }
          await route.fulfill({ status: 200, headers: SSE_HEADERS, body: sseBody(CLIENT_BUNDLE) });
        });
        await page.route("**/client/telemetry/v1", async (route) => {
          await route.fulfill({ status: 202, headers: { "access-control-allow-origin": "*" } });
        });

        await page.goto(url("/"));
        await expect
          .poll(async () => (await page.locator('[data-testid="status"]').textContent())?.trim(), {
            timeout: 15_000,
          })
          .toBe("ready");

        expect(capturedMetaContext).toMatchObject({ appName: "test-app", appVersion: "1.2.3" });

        await page.close();
      },
    );
  });
});
