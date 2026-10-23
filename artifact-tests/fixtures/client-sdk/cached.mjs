import { createClient } from "@configdirector/client-sdk";

try {
  const reasons = {};
  let cachedValuesLoaded = false;
  const client = createClient("test-client-sdk-key", {
    connection: { url: __BASE_URL__, mode: "streaming", timeout: 2_000 },
    hooks: {
      configEvaluated: ({ evaluation }) => (reasons[evaluation.key] = evaluation.reason),
      cachedValuesLoaded: () => (cachedValuesLoaded = true),
    },
  });
  await client.initialize({ id: "user-1" });
  const values = {
    ready: client.isReady,
    welcomeMessage: client.getValue("welcome-message", "fallback"),
    featureEnabled: client.getValue("feature-enabled", false),
    itemCount: client.getValue("item-count", 0),
  };
  await new Promise((resolve) => setTimeout(resolve, 100));
  client.dispose();
  window.__SMOKE__ = { ok: true, values, cachedValuesLoaded, reasons };
} catch (error) {
  window.__SMOKE__ = { ok: false, error: String(error?.stack ?? error) };
}
