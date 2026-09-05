import { createApp, h, watchEffect } from "vue";
import { ConfigDirectorPlugin, useConfigValue } from "@configdirector/vue-sdk";

const Probe = {
  setup() {
    const welcome = useConfigValue("welcome-message", "fallback");
    const enabled = useConfigValue("feature-enabled", false);
    const count = useConfigValue("item-count", 0);

    watchEffect(() => {
      if (window.__SMOKE__) {
        return;
      }
      if (welcome.readyStatus.value === "ready") {
        window.__SMOKE__ = {
          ok: true,
          values: {
            welcomeMessage: welcome.value.value,
            featureEnabled: enabled.value.value,
            itemCount: count.value.value,
          },
        };
      } else if (welcome.readyStatus.value === "default") {
        window.__SMOKE__ = { ok: false, error: "the client initialized with the 'default' status" };
      }
    });

    return () => h("div", { id: "value" }, String(welcome.value.value));
  },
};

createApp({ render: () => h(Probe) })
  .use(ConfigDirectorPlugin, { sdkKey: "test-client-sdk-key", url: __BASE_URL__, timeout: 10_000 })
  .mount("#app");
