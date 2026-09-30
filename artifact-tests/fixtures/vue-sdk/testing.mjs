import { createApp, defineComponent, h, nextTick } from "vue";
import { ConfigDirectorPlugin, useConfigValue, useClientStatus } from "@configdirector/vue-sdk";
import { createTestClient } from "@configdirector/vue-sdk/testing";

const testClient = createTestClient({
  values: { "welcome-message": "Hello from ConfigDirector!", "feature-enabled": true, "item-count": 7 },
});

const Probe = defineComponent({
  setup() {
    const welcome = useConfigValue("welcome-message", "fallback");
    const enabled = useConfigValue("feature-enabled", false);
    const count = useConfigValue("item-count", 0);
    const { readyStatus } = useClientStatus();
    return () => {
      if (!window.__SMOKE__ && readyStatus.value === "ready") {
        if (count.value.value === 7) {
          testClient.setValue("item-count", 8);
        } else {
          window.__SMOKE__ = {
            ok: true,
            values: {
              welcomeMessage: welcome.value.value,
              featureEnabled: enabled.value.value,
              itemCount: count.value.value,
            },
          };
        }
      }
      return h("div", { id: "value" }, String(welcome.value.value));
    };
  },
});

const app = createApp(Probe);
app.use(ConfigDirectorPlugin, testClient.client);
app.mount("#app");
await nextTick();
