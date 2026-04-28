import { DefaultConfigDirectorClient } from "@js-server-sdk/DefaultConfigDirectorClient";
import { type ConfigDirectorClient } from "@js-server-sdk/types";
import { defineNitroPlugin, useRuntimeConfig } from "nitropack/runtime";
import { createDefaultLogger } from "../logger";

export default defineNitroPlugin((nitroApp) => {
  const runtimeConfig = useRuntimeConfig();
  const logger = createDefaultLogger(runtimeConfig.configdirector?.logLevel);
  logger.debug("Initializing ConfigDirector Nitro plugin");
  const client: ConfigDirectorClient = new DefaultConfigDirectorClient(
    runtimeConfig.configdirector.serverSdkKey,
    { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
    { logger },
  );

  nitroApp.configDirectorClient = client;
  client.initialize();
});

declare module "nitropack" {
  interface NitroApp {
    configDirectorClient: ConfigDirectorClient;
  }
}
