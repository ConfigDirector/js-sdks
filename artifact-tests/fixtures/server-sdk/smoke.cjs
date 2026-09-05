const { createClient } = require("@configdirector/server-sdk");

const main = async () => {
  const client = createClient("test-server-sdk-key", {
    connection: {
      url: process.env.CONFIGDIRECTOR_BASE_URL,
      mode: process.env.CONFIGDIRECTOR_CONNECTION_MODE ?? "streaming",
      timeout: 10_000,
    },
  });
  await client.initialize();
  const values = {
    ready: client.isReady,
    welcomeMessage: client.getValue("welcome-message", "fallback"),
    featureEnabled: client.getValue("feature-enabled", false),
    itemCount: client.getValue("item-count", 0),
    jsonData: client.getValue("json-data", {}),
  };
  client.dispose();
  return values;
};

main().then(
  (values) => process.stdout.write(`${JSON.stringify(values)}\n`, () => process.exit(0)),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
