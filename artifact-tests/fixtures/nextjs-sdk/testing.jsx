import { createRoot } from "react-dom/client";
import { ConfigDirectorProvider, useConfigValue } from "@configdirector/nextjs-sdk/client";
import { createTestClient, installTestClient } from "@configdirector/nextjs-sdk/client/testing";

const testClient = createTestClient({
  values: { "welcome-message": "Hello from ConfigDirector!", "feature-enabled": true, "item-count": 7 },
});
installTestClient(testClient);

const Probe = () => {
  const welcome = useConfigValue("welcome-message", "fallback");
  const enabled = useConfigValue("feature-enabled", false);
  const count = useConfigValue("item-count", 0);

  if (!window.__SMOKE__ && welcome.readyStatus === "ready") {
    if (count.value === 7) {
      testClient.setValue("item-count", 8);
    } else {
      window.__SMOKE__ = {
        ok: true,
        values: { welcomeMessage: welcome.value, featureEnabled: enabled.value, itemCount: count.value },
      };
    }
  }

  return <div id="value">{String(welcome.value)}</div>;
};

createRoot(document.getElementById("app")).render(
  <ConfigDirectorProvider sdkKey="test-client-sdk-key" url={__BASE_URL__} timeout={10_000}>
    <Probe />
  </ConfigDirectorProvider>,
);
