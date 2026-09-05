import { getConfigClient, register } from "@configdirector/nextjs-sdk/server";

await register({
  serverSdkKey: "test-server-sdk-key",
  connection: { url: process.env.CONFIGDIRECTOR_BASE_URL, timeout: 10_000 },
});
const client = getConfigClient();
const values = {
  ready: client.isReady,
  welcomeMessage: client.getValue("welcome-message", "fallback"),
  featureEnabled: client.getValue("feature-enabled", false),
  itemCount: client.getValue("item-count", 0),
  jsonData: client.getValue("json-data", {}),
};
client.dispose();
process.stdout.write(`${JSON.stringify(values)}\n`, () => process.exit(0));
