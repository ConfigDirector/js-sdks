import { describe, test, expect } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { tryUseNuxtApp } from "#app";
import { createTestClient, installTestClient } from "../../src/testing";
import { useConfigDirectorClient } from "../../src/runtime/app/composables/useConfigDirectorClient";
import { useConfigDirectorContext } from "../../src/runtime/app/composables/useConfigDirectorContext";
import { useConfigDirectorStatus } from "../../src/runtime/app/composables/useConfigDirectorStatus";
import { useConfigDirectorValue } from "../../src/runtime/app/composables/useConfigDirectorValue";

const appCreatedBeforeThisFile = tryUseNuxtApp()?.vueApp !== undefined;

const testClient = createTestClient({
  values: { "welcome-message": "Hello from the test client", "item-count": 7 },
});
installTestClient(testClient);

const WelcomeMessage = defineComponent({
  setup() {
    const { value: welcomeMessage } = useConfigDirectorValue("welcome-message", "default-message");
    const { value: itemCount } = useConfigDirectorValue("item-count", 0);
    const { readyStatus } = useConfigDirectorStatus();
    return () => [
      h("div", { "data-testid": "welcome" }, welcomeMessage.value),
      h("div", { "data-testid": "item-count" }, String(itemCount.value)),
      h("div", { "data-testid": "status" }, readyStatus.value),
    ];
  },
});

describe.skipIf(appCreatedBeforeThisFile)(
  "a Nuxt app created after installTestClient (needs @nuxt/test-utils 4, which creates the app in a beforeAll)",
  () => {
    test("provides the installed client, ready with the seeded values, without a clientSdkKey", () => {
      const { client } = useConfigDirectorClient();

      expect(client).toBe(testClient.client);
      expect(client.isReady).toBe(true);
      expect(client.getValue("welcome-message", "default-message")).toBe("Hello from the test client");
    });

    test("renders the test client's values and reflects setValue and removeValue (S16)", async () => {
      const component = await mountSuspended(WelcomeMessage);
      expect(component.find("[data-testid=welcome]").text()).toBe("Hello from the test client");
      expect(component.find("[data-testid=item-count]").text()).toBe("7");
      expect(component.find("[data-testid=status]").text()).toBe("ready");

      testClient.setValue("welcome-message", "Changed by the test");
      testClient.removeValue("item-count");
      await nextTick();

      expect(component.find("[data-testid=welcome]").text()).toBe("Changed by the test");
      expect(component.find("[data-testid=item-count]").text()).toBe("0");
    });

    test("records the contexts of the app's initialize and updateContext calls", async () => {
      const { updateContext } = useConfigDirectorContext();

      await updateContext({ id: "user-1" });

      expect(testClient.contextUpdates).toEqual([{}, { id: "user-1" }]);
      expect(testClient.client.context).toEqual({ id: "user-1" });
    });
  },
);
