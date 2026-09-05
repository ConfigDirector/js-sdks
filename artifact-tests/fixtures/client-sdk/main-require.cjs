const { createClient } = require("@configdirector/client-sdk");

const main = async () => {
  const client = createClient("test-client-sdk-key", {
    connection: { url: __BASE_URL__, mode: "polling", timeout: 10_000 },
  });
  await client.initialize();
  const values = {
    ready: client.isReady,
    welcomeMessage: client.getValue("welcome-message", "fallback"),
    featureEnabled: client.getValue("feature-enabled", false),
    itemCount: client.getValue("item-count", 0),
  };
  client.dispose();
  return values;
};

main().then(
  (values) => {
    window.__SMOKE__ = { ok: true, values };
  },
  (error) => {
    window.__SMOKE__ = { ok: false, error: String(error?.stack ?? error) };
  },
);
