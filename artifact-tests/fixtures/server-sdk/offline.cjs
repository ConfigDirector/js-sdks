const { createClient } = require("@configdirector/server-sdk");

const main = async () => {
  const client = createClient({
    connection: {
      mode: "offline",
      url: process.env.CONFIGDIRECTOR_BASE_URL,
      values: {
        "welcome-message": "Hello from ConfigDirector!",
        "feature-enabled": true,
        "item-count": 7,
        "json-data": { greeting: "hello", count: 3 },
      },
    },
  });
  await client.initialize();
  const values = {
    ready: client.isReady,
    welcomeMessage: client.getValue("welcome-message", "fallback", { id: "user-1" }),
    featureEnabled: client.getValue("feature-enabled", false, { id: "user-1" }),
    itemCount: client.getValue("item-count", 0, { id: "user-1" }),
    jsonData: client.getValue("json-data", {}, { id: "user-1" }),
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
