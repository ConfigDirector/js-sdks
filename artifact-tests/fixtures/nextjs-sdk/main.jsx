import { createRoot } from "react-dom/client";
import { ConfigDirectorProvider, useConfigValue } from "@configdirector/nextjs-sdk/client";

const Probe = () => {
  const welcome = useConfigValue("welcome-message", "fallback");
  const enabled = useConfigValue("feature-enabled", false);
  const count = useConfigValue("item-count", 0);

  if (!window.__SMOKE__) {
    if (welcome.readyStatus === "ready") {
      window.__SMOKE__ = {
        ok: true,
        values: {
          welcomeMessage: welcome.value,
          featureEnabled: enabled.value,
          itemCount: count.value,
        },
      };
    } else if (welcome.readyStatus === "default") {
      window.__SMOKE__ = { ok: false, error: "the client initialized with the 'default' status" };
    }
  }

  return <div id="value">{String(welcome.value)}</div>;
};

createRoot(document.getElementById("app")).render(
  <ConfigDirectorProvider sdkKey="test-client-sdk-key" url={__BASE_URL__} timeout={10_000}>
    <Probe />
  </ConfigDirectorProvider>,
);
