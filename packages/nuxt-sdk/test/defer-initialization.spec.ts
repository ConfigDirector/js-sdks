import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";
import { setup, createPage, url } from "@nuxt/test-utils/e2e";
import { acceptTelemetry, refuseClientConnections, serveClientBundle } from "./helpers/browser-routes";
import type { ClientConnectionRequest } from "./helpers/browser-routes";
import { textOf } from "./helpers/browser-page";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/configdirector", import.meta.url));
const BROWSER_INITIALIZATION_TIMEOUT_MILLISECONDS = 2_000;

describe("ConfigDirector Nuxt SDK — deferInitialization turned on by its environment variable, with SSR off", async () => {
  await setup({
    rootDir: FIXTURE_DIR,
    browser: true,
    nuxtConfig: { ssr: false },
    env: { NUXT_PUBLIC_CONFIGDIRECTOR_DEFER_INITIALIZATION: "true" },
  });

  test("opens no connection and stays loading while the app has set no context", { timeout: 30_000 }, async () => {
    const page = await createPage();
    const connectionRequests: ClientConnectionRequest[] = [];
    await serveClientBundle(page, connectionRequests);
    await acceptTelemetry(page);

    await page.goto(url("/context-test"));

    await textOf(page, "status").toBe("loading");
    await textOf(page, "welcome").toBe("default-message");
    await page.waitForTimeout(BROWSER_INITIALIZATION_TIMEOUT_MILLISECONDS + 500);
    expect(connectionRequests).toEqual([]);
    await textOf(page, "status").toBe("loading");

    await page.close();
  });

  test("opens exactly one connection, carrying the context, when the app sets its first context", { timeout: 30_000 }, async () => {
    const page = await createPage();
    const connectionRequests: ClientConnectionRequest[] = [];
    await serveClientBundle(page, connectionRequests);
    await acceptTelemetry(page);
    await page.goto(url("/context-test"));
    await textOf(page, "status").toBe("loading");

    await page.locator('[data-testid="set-context-btn"]').click();

    await textOf(page, "status").toBe("ready");
    await textOf(page, "welcome").toBe("Hello from ConfigDirector!");
    await textOf(page, "context-id").toBe("test-user-1");
    expect(connectionRequests.map((request) => request.givenContext)).toEqual([{ id: "test-user-1", name: "Test User" }]);

    await page.close();
  });

  test("serves the values kept on the device for the first context until live values arrive", { timeout: 30_000 }, async () => {
    const page = await createPage();
    const firstVisitRequests: ClientConnectionRequest[] = [];
    await serveClientBundle(page, firstVisitRequests);
    await acceptTelemetry(page);
    await page.goto(url("/context-test"));
    await page.locator('[data-testid="set-context-btn"]').click();
    await textOf(page, "welcome").toBe("Hello from ConfigDirector!");
    const refusedRequests: ClientConnectionRequest[] = [];
    await refuseClientConnections(page, refusedRequests);
    await page.reload();
    await textOf(page, "welcome").toBe("default-message");

    await page.locator('[data-testid="set-context-btn"]').click();

    await textOf(page, "welcome").toBe("Hello from ConfigDirector!");
    await textOf(page, "status").toBe("default");
    const refusedContexts = refusedRequests.map((request) => request.givenContext);
    expect(refusedContexts.length).toBeGreaterThanOrEqual(1);
    expect(refusedContexts.filter((context) => context?.id !== "test-user-1")).toEqual([]);

    await page.close();
  });
});
