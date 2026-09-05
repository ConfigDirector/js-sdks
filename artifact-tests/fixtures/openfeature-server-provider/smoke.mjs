import { OpenFeature } from "@openfeature/server-sdk";
import { ConfigDirectorProvider } from "@configdirector/openfeature-server-provider";

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
process.stdout.write(`${JSON.stringify(values)}\n`, () => process.exit(0));
