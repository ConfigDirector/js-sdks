import { createTestClient, ConfigDirectorValidationError } from "@configdirector/server-sdk/testing";

const main = async () => {
  const testClient = createTestClient({
    values: {
      "welcome-message": "Hello from ConfigDirector!",
      "feature-enabled": true,
      "item-count": 7,
      "json-data": { greeting: "hello", count: 3 },
    },
  });
  await testClient.client.initialize();
  testClient.setValue("item-count", 8);
  let rejected = false;
  try {
    testClient.setValue("item-count", Number.NaN);
  } catch (error) {
    rejected = error instanceof ConfigDirectorValidationError;
  }
  const values = {
    ready: testClient.client.isReady,
    welcomeMessage: testClient.client.getValue("welcome-message", "fallback"),
    featureEnabled: testClient.client.getValue("feature-enabled", false),
    itemCount: testClient.client.getValue("item-count", 0),
    jsonData: testClient.client.getValue("json-data", {}),
    rejected,
  };
  testClient.client.dispose();
  return values;
};

main().then((values) => process.stdout.write(`${JSON.stringify(values)}\n`, () => process.exit(0)));
