import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils/e2e";
import { HELD_SERVER_SDK_KEY, releaseHeldServerBundles } from "./helpers/mock-sse-server";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/configdirector", import.meta.url));
const SERVER_SDK_DEFAULT_TIMEOUT_MS = 3_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("ConfigDirector Nuxt SDK — requests arriving before the server client is ready", async () => {
  await setup({
    rootDir: FIXTURE_DIR,
    env: {
      NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY: HELD_SERVER_SDK_KEY,
      NUXT_CONFIGDIRECTOR_CONNECTION_TIMEOUT: "10000",
    },
  });

  test(
    "holds the request until the initial config payload arrives, for up to the configured connection timeout",
    { timeout: 30_000 },
    async () => {
      const pendingRequest = $fetch<{ welcomeMessage: string; isReady: boolean }>("/api/config");
      await sleep(SERVER_SDK_DEFAULT_TIMEOUT_MS + 500);
      await releaseHeldServerBundles(process.env.NUXT_CONFIGDIRECTOR_BASE_URL!);

      const data = await pendingRequest;
      expect(data.isReady).toBe(true);
      expect(data.welcomeMessage).toBe("Hello from ConfigDirector!");
    },
  );
});
