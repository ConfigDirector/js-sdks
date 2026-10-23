import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";
import { setup, createPage, url } from "@nuxt/test-utils/e2e";
import { acceptTelemetry, serveClientBundle } from "./helpers/browser-routes";
import type { ClientConnectionRequest } from "./helpers/browser-routes";
import { textOf } from "./helpers/browser-page";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/configdirector", import.meta.url));

describe("ConfigDirector Nuxt SDK — deferInitialization with a context set during server-side rendering", async () => {
  await setup({
    rootDir: FIXTURE_DIR,
    browser: true,
    nuxtConfig: { runtimeConfig: { public: { configdirector: { deferInitialization: true } } } },
  });

  test("starts the client when the app is created, with one connection carrying the rendered context", { timeout: 30_000 }, async () => {
    const page = await createPage();
    const connectionRequests: ClientConnectionRequest[] = [];
    await serveClientBundle(page, connectionRequests);
    await acceptTelemetry(page);

    await page.goto(url("/ssr-context-test"));

    await textOf(page, "status").toBe("ready");
    await textOf(page, "context-id").toBe("ssr-user-1");
    await textOf(page, "welcome").toBe("Hello from ConfigDirector!");
    await page.waitForTimeout(500);
    expect(connectionRequests.map((request) => request.givenContext)).toEqual([{ id: "ssr-user-1" }]);

    await page.close();
  });
});
