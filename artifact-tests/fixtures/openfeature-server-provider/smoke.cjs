const { OpenFeature } = require("@openfeature/server-sdk");
const { ConfigDirectorProvider } = require("@configdirector/openfeature-server-provider");

const main = async () => {
  await OpenFeature.setProviderAndWait(
    new ConfigDirectorProvider("test-server-sdk-key", {
      connection: { url: process.env.CONFIGDIRECTOR_BASE_URL, timeout: 10_000 },
    }),
  );
  const client = OpenFeature.getClient();
  const values = {
    welcomeMessage: await client.getStringValue("welcome-message", "fallback"),
    featureEnabled: await client.getBooleanValue("feature-enabled", false),
    itemCount: await client.getNumberValue("item-count", 0),
    jsonData: await client.getObjectValue("json-data", {}),
  };
  await OpenFeature.close();
  return values;
};

main().then(
  (values) => process.stdout.write(`${JSON.stringify(values)}\n`, () => process.exit(0)),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
