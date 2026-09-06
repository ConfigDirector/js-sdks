import { fileURLToPath } from "node:url";
import { describe, test, expect, vi } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils/e2e";
import { HELD_SERVER_SDK_KEY, releaseHeldServerBundles } from "./helpers/mock-sse-server";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/configdirector", import.meta.url));
const INITIALIZATION_TIMEOUT_MS = 10_000;

type ConfigResponse = { welcomeMessage: string; isReady: boolean };

describe("ConfigDirector Nuxt SDK — waitForInitialization disabled via environment variable", async () => {
  await setup({
    rootDir: FIXTURE_DIR,
    env: {
      NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY: HELD_SERVER_SDK_KEY,
      NUXT_CONFIGDIRECTOR_CONNECTION_TIMEOUT: String(INITIALIZATION_TIMEOUT_MS),
      NUXT_CONFIGDIRECTOR_WAIT_FOR_INITIALIZATION: "false",
    },
  });

  test(
    "handles a request arriving before the initial config payload immediately with default values",
    { timeout: INITIALIZATION_TIMEOUT_MS + 5_000 },
    async () => {
      const startedAt = Date.now();
      const data = await $fetch<ConfigResponse>("/api/config");

      expect(Date.now() - startedAt).toBeLessThan(INITIALIZATION_TIMEOUT_MS / 2);
      expect(data.isReady).toBe(false);
      expect(data.welcomeMessage).toBe("default-message");
    },
  );

  test("serves real config values once the initial payload arrives", { timeout: 15_000 }, async () => {
    await releaseHeldServerBundles(process.env.NUXT_CONFIGDIRECTOR_BASE_URL!);

    await vi.waitFor(
      async () => {
        const data = await $fetch<ConfigResponse>("/api/config");
        expect(data.isReady).toBe(true);
        expect(data.welcomeMessage).toBe("Hello from ConfigDirector!");
      },
      { timeout: 10_000, interval: 100 },
    );
  });
});
