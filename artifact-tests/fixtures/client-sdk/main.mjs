import { createClient } from "@configdirector/client-sdk";

try {
  const client = createClient("test-client-sdk-key", {
    connection: { url: __BASE_URL__, mode: "streaming", timeout: 10_000 },
  });
  await client.initialize();
  const values = {
    ready: client.isReady,
    welcomeMessage: client.getValue("welcome-message", "fallback"),
    featureEnabled: client.getValue("feature-enabled", false),
    itemCount: client.getValue("item-count", 0),
  };
  client.dispose();
  window.__SMOKE__ = { ok: true, values };
} catch (error) {
  window.__SMOKE__ = { ok: false, error: String(error?.stack ?? error) };
}
