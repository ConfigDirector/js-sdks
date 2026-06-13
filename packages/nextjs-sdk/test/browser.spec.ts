import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { CLIENT_BUNDLE } from "./helpers/mock-sse-server";

const url = (path: string) => `${process.env["NEXTJS_SDK_TEST_URL"]}${path}`;

const sseBody = (bundle: object) => `data: ${JSON.stringify(bundle)}\n\n`;

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

const textOf = (page: Page, selector: string) =>
  expect.poll(async () => (await page.locator(selector).textContent())?.trim(), {
    timeout: 15_000,
  });

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
});

describe("ConfigDirector Next.js SDK — Browser client (hydration and live updates)", () => {
  it("updates config values in the DOM after client-side hydration", { timeout: 30_000 }, async () => {
    const page = await browser.newPage();

    await page.route("**/client/sse/v1", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
        return;
      }
      await route.fulfill({ status: 200, headers: SSE_HEADERS, body: sseBody(CLIENT_BUNDLE) });
    });
    await page.route("**/client/telemetry/v1", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
        return;
      }
      await route.fulfill({ status: 202, headers: { "access-control-allow-origin": "*" } });
    });

    await page.goto(url("/"));

    await textOf(page, '[data-testid="welcome"]').toBe("Hello from ConfigDirector!");
    await textOf(page, '[data-testid="status"]').toBe("ready");
    await textOf(page, '[data-testid="loading"]').toBe("done");
    await textOf(page, '[data-testid="feature-enabled"]').toBe("true");
    await textOf(page, '[data-testid="item-count"]').toBe("7");

    await page.close();
  });

  it(
    "falls back to 'default' status when the SSE connection cannot be established",
    { timeout: 30_000 },
    async () => {
      const page = await browser.newPage();

      // Abort all SSE connections → the 2 s initialize() timeout fires → readyStatus = "default"
      await page.route("**/client/sse/v1", async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
          return;
        }
        await route.abort();
      });
      await page.route("**/client/telemetry/v1", async (route) => {
        await route.fulfill({ status: 202, headers: { "access-control-allow-origin": "*" } });
      });

      await page.goto(url("/"));

      await textOf(page, '[data-testid="status"]').toBe("default");
      await textOf(page, '[data-testid="loading"]').toBe("done");

      // Config values fall back to initialConfigs from the server even when the browser client
      // times out — the server-evaluated values remain visible.
      await textOf(page, '[data-testid="welcome"]').toBe("Hello from ConfigDirector!");

      await page.close();
    },
  );

  it(
    "returns the parsed object when the server sends a json config and the default is an object",
    { timeout: 30_000 },
    async () => {
      const page = await browser.newPage();

      const jsonBundle = {
        ...CLIENT_BUNDLE,
        configs: {
          ...CLIENT_BUNDLE.configs,
          "json-data": {
            id: "00000000-0000-0000-0000-000000000004",
            key: "json-data",
            type: "json",
            value: JSON.stringify({ greeting: "hello", count: 3 }),
          },
        },
      };

      await page.route("**/client/sse/v1", async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
          return;
        }
        await route.fulfill({ status: 200, headers: SSE_HEADERS, body: sseBody(jsonBundle) });
      });
      await page.route("**/client/telemetry/v1", async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
          return;
        }
        await route.fulfill({ status: 202, headers: { "access-control-allow-origin": "*" } });
      });

      await page.goto(url("/"));

      await textOf(page, '[data-testid="json-data"]').toBe(JSON.stringify({ greeting: "hello", count: 3 }));

      await page.close();
    },
  );

  it(
    "falls back to the default object when the json config is not in the server response",
    { timeout: 30_000 },
    async () => {
      const page = await browser.newPage();

      await page.route("**/client/sse/v1", async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
          return;
        }
        await route.fulfill({ status: 200, headers: SSE_HEADERS, body: sseBody(CLIENT_BUNDLE) });
      });
      await page.route("**/client/telemetry/v1", async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
          return;
        }
        await route.fulfill({ status: 202, headers: { "access-control-allow-origin": "*" } });
      });

      await page.goto(url("/"));

      await textOf(page, '[data-testid="json-data"]').toBe(JSON.stringify({ label: "default" }));

      await page.close();
    },
  );

  it("returns the raw json string when the default value type is string", { timeout: 30_000 }, async () => {
    const page = await browser.newPage();

    const jsonBundle = {
      ...CLIENT_BUNDLE,
      configs: {
        ...CLIENT_BUNDLE.configs,
        "json-data-raw": {
          id: "00000000-0000-0000-0000-000000000005",
          key: "json-data-raw",
          type: "json",
          value: JSON.stringify({ greeting: "hello" }),
        },
      },
    };

    await page.route("**/client/sse/v1", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
        return;
      }
      await route.fulfill({ status: 200, headers: SSE_HEADERS, body: sseBody(jsonBundle) });
    });
    await page.route("**/client/telemetry/v1", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
        return;
      }
      await route.fulfill({ status: 202, headers: { "access-control-allow-origin": "*" } });
    });

    await page.goto(url("/"));

    await textOf(page, '[data-testid="json-data-raw"]').toBe(JSON.stringify({ greeting: "hello" }));

    await page.close();
  });

  it("reconnects and sends the new context when updateContext is called", { timeout: 30_000 }, async () => {
    const capturedPayloads: unknown[] = [];
    const page = await browser.newPage();

    let requestCount = 0;
    await page.route("**/client/sse/v1", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
        return;
      }
      const rawBody = route.request().postData();
      if (rawBody) capturedPayloads.push(JSON.parse(rawBody));
      requestCount++;
      await route.fulfill({ status: 200, headers: SSE_HEADERS, body: sseBody(CLIENT_BUNDLE) });
    });
    await page.route("**/client/telemetry/v1", async (route) => {
      await route.fulfill({ status: 202, headers: { "access-control-allow-origin": "*" } });
    });

    await page.goto(url("/context-test"));

    // Wait for the initial SSE connection to complete
    await textOf(page, '[data-testid="status"]').toBe("ready");
    expect(requestCount).toBe(1);

    // Trigger updateContext via the button on the fixture page
    await page.locator('[data-testid="set-context-btn"]').click();

    // updateContext triggers a reconnect — expect a second SSE request
    await expect.poll(() => requestCount, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    // The second request body should carry the new context
    const firstPayload = capturedPayloads[0] as { instanceId?: string };
    const secondPayload = capturedPayloads[1] as { givenContext?: { id: string }; instanceId?: string };
    expect(secondPayload?.givenContext).toMatchObject({ id: "test-user-1" });

    // Both requests are sent with the same generated instanceId for this client instance
    expect(firstPayload?.instanceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(secondPayload?.instanceId).toBe(firstPayload?.instanceId);

    // The context-id display should update
    await textOf(page, '[data-testid="context-id"]').toBe("test-user-1");

    await page.close();
  });

  it(
    "telemetry web worker sends evaluation events to the telemetry endpoint",
    { timeout: 30_000 },
    async () => {
      const page = await browser.newPage();
      const telemetryPayloads: unknown[] = [];

      await page.route("**/client/sse/v1", async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
          return;
        }
        await route.fulfill({ status: 200, headers: SSE_HEADERS, body: sseBody(CLIENT_BUNDLE) });
      });
      await page.route("**/client/telemetry/v1", async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
          return;
        }
        const rawBody = route.request().postData();
        if (rawBody) telemetryPayloads.push(JSON.parse(rawBody));
        await route.fulfill({ status: 202, headers: { "access-control-allow-origin": "*" } });
      });

      await page.goto(url("/"));

      // Wait for the client to be ready and configs to be evaluated
      await textOf(page, '[data-testid="status"]').toBe("ready");
      await textOf(page, '[data-testid="welcome"]').toBe("Hello from ConfigDirector!");

      // Register a waiter before triggering the flush so we don't miss it
      const telemetryDone = page.waitForResponse(
        (resp) => resp.url().includes("/client/telemetry/v1") && resp.request().method() === "POST",
        { timeout: 15_000 },
      );

      // Trigger the telemetry worker flush via the visibilitychange event
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      await telemetryDone;

      expect(telemetryPayloads.length).toBeGreaterThanOrEqual(1);
      const payload = telemetryPayloads[0] as Record<string, unknown>;
      expect(payload).toHaveProperty("aggregatedEvents");

      await page.close();
    },
  );
});
