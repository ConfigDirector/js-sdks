import { createClient } from "@configdirector/server-sdk";

const client = createClient({
  connection: { mode: "offline", url: process.env.CONFIGDIRECTOR_BASE_URL, file: "./flags/offline.json" },
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
process.stdout.write(`${JSON.stringify(values)}\n`, () => process.exit(0));
