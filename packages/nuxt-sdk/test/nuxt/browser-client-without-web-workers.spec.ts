import { afterAll, describe, expect, test } from "vitest";
import { defineComponent, h } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { tryUseNuxtApp } from "#app";
import { startMockSseServer } from "../helpers/mock-sse-server";
import { useConfigDirectorClient } from "../../src/runtime/app/composables/useConfigDirectorClient";
import { useConfigDirectorStatus } from "../../src/runtime/app/composables/useConfigDirectorStatus";
import { useConfigDirectorValue } from "../../src/runtime/app/composables/useConfigDirectorValue";

const appCreatedBeforeThisFile = tryUseNuxtApp()?.vueApp !== undefined;

const mockServer = await startMockSseServer();
Object.assign(window.__NUXT__?.config.public.configdirector, {
  clientSdkKey: "test-client-sdk-key",
  baseUrl: mockServer.baseUrl,
});

const unhandledRejections: unknown[] = [];
const recordUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
process.on("unhandledRejection", recordUnhandledRejection);
const waitForPendingRejectionsToSurface = () => new Promise((resolve) => setTimeout(resolve));

afterAll(async () => {
  process.off("unhandledRejection", recordUnhandledRejection);
  await mockServer.close();
});

const WelcomeMessage = defineComponent({
  setup() {
    const { value: welcomeMessage } = useConfigDirectorValue("welcome-message", "default-message");
    const { readyStatus } = useConfigDirectorStatus();
    return () => [
      h("div", { "data-testid": "welcome" }, welcomeMessage.value),
      h("div", { "data-testid": "status" }, readyStatus.value),
    ];
  },
});

describe.skipIf(appCreatedBeforeThisFile)(
  "a Nuxt app whose real browser client runs under jsdom, which has no Web Workers (needs @nuxt/test-utils 4, which creates the app in a beforeAll)",
  () => {
    afterAll(() => {
      useConfigDirectorClient().client.dispose();
    });

    test("initializes with the browser client ready and serving the server's values", async () => {
      const component = await mountSuspended(WelcomeMessage);

      expect(component.find("[data-testid=status]").text()).toBe("ready");
      expect(component.find("[data-testid=welcome]").text()).toBe("Hello from ConfigDirector!");
    });

    test("leaves no rejection unhandled", async () => {
      await waitForPendingRejectionsToSurface();

      expect(unhandledRejections).toEqual([]);
    });
  },
);
