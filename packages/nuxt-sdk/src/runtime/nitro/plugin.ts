import {
  type ConfigDirectorClient,
  createClient,
} from "@configdirector/server-sdk";
import { defineNitroPlugin, useRuntimeConfig } from "nitropack/runtime";

export default defineNitroPlugin((nitroApp) => {
  const runtimeConfig = useRuntimeConfig();
  console.log("Initializing ConfigDirector server SDK");
  const client: ConfigDirectorClient = createClient(
    runtimeConfig.configdirector.serverSdkKey,
  );
  // Attach it to the nitroApp context to access it elsewhere
  nitroApp.configDirectorClient = client;
  client.initialize();
});

// Add to your types (types/nitro.d.ts)
declare module "nitropack" {
  interface NitroApp {
    configDirectorClient: ConfigDirectorClient;
  }
}
