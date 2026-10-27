import { OpenFeature } from "@openfeature/server-sdk";
import { ConfigDirectorProvider } from "@configdirector/openfeature-server-provider";
import { createConfigsServer } from "./app.ts";

const serverSdkKey = process.env["CONFIGDIRECTOR_SERVER_KEY"] ?? "";
const port = Number(process.env["PORT"] ?? 3600);

try {
  await OpenFeature.setProviderAndWait(new ConfigDirectorProvider(serverSdkKey));
} catch (error) {
  console.warn("Starting on in-code default values until ConfigDirector sends config:", error);
}

createConfigsServer(OpenFeature.getClient()).listen(port, () => {
  console.log(`ConfigDirector OpenFeature server sample listening on http://localhost:${port}/configs`);
});
