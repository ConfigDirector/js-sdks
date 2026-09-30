import { createTestClient, installServerTestClient } from "@configdirector/nextjs-sdk/server/testing";
import { getConfigClient, ConfigDirectorProvider } from "@configdirector/nextjs-sdk/server";

const main = async () => {
  const testClient = createTestClient({
    values: {
      "welcome-message": "Hello from ConfigDirector!",
      "feature-enabled": true,
      "item-count": 7,
      "json-data": { greeting: "hello", count: 3 },
    },
  });
  const uninstall = installServerTestClient(testClient);
  await testClient.client.initialize();
  testClient.setValue("item-count", 8);
  const client = getConfigClient();
  const element = await ConfigDirectorProvider({ sdkKey: "test-client-sdk-key", children: null });
  const values = {
    ready: client.isReady,
    welcomeMessage: client.getValue("welcome-message", "fallback"),
    featureEnabled: client.getValue("feature-enabled", false),
    itemCount: client.getValue("item-count", 0),
    jsonData: client.getValue("json-data", {}),
    ssrItemCount: element.props.initialConfigs["item-count"].value,
  };
  uninstall();
  testClient.client.dispose();
  return values;
};

main().then((values) => process.stdout.write(`${JSON.stringify(values)}\n`, () => process.exit(0)));
