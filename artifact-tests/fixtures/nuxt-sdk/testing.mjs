import { createTestClient, installTestClient, ConfigDirectorValidationError } from "@configdirector/nuxt-sdk/testing";

const main = async () => {
  const testClient = createTestClient({
    values: {
      "welcome-message": "Hello from ConfigDirector!",
      "feature-enabled": true,
      "item-count": 7,
    },
  });
  const uninstall = installTestClient(testClient);
  const installed = globalThis[Symbol.for("@configdirector/installed-test-client")] === testClient.client;
  uninstall();
  const uninstalled = globalThis[Symbol.for("@configdirector/installed-test-client")] === undefined;
  await testClient.client.initialize({ id: "user-1" });
  testClient.setValue("item-count", 8);
  let rejected = false;
  try {
    testClient.setValue("item-count", Number.NaN);
  } catch (error) {
    rejected = error instanceof ConfigDirectorValidationError;
  }
  const values = {
    ready: testClient.client.isReady,
    installed,
    uninstalled,
    welcomeMessage: testClient.client.getValue("welcome-message", "fallback"),
    featureEnabled: testClient.client.getValue("feature-enabled", false),
    itemCount: testClient.client.getValue("item-count", 0),
    rejected,
  };
  testClient.client.dispose();
  return values;
};

main().then((values) => process.stdout.write(`${JSON.stringify(values)}\n`, () => process.exit(0)));
