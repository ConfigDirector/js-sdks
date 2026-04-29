import { DefaultConfigDirectorClient } from "@js-server-sdk/DefaultConfigDirectorClient";
import { type ConfigDirectorClient } from "@js-server-sdk/types";
import { defineNitroPlugin, useRuntimeConfig } from "nitropack/runtime";
import { createDefaultLogger } from "../logger";
import { ConfigDirectorInitializationError } from "@shared/errors";

export default defineNitroPlugin((nitroApp) => {
  const runtimeConfig = useRuntimeConfig();
  const logger = createDefaultLogger(runtimeConfig.configdirector?.logLevel);

  if (!runtimeConfig.configdirector.serverSdkKey) {
    const message =
      "The ConfigDirector serverSdkKey must be configured for the plugin to initialize. You can provide it in nuxt.config.ts under 'runtimeConfig.configdirector.serverSdkKey' or as a runtime environment variable named NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY";
    logger.error(message);
    throw new ConfigDirectorInitializationError(message);
  }

  logger.debug("Initializing ConfigDirector Nitro plugin");
  const { serverSdkKey, baseUrl } = runtimeConfig.configdirector;
  const client: ConfigDirectorClient = new DefaultConfigDirectorClient(
    serverSdkKey,
    { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
    {
      logger,
      ...(baseUrl ? { connection: { url: baseUrl } } : {}),
    },
  );

  nitroApp.configDirectorClient = client;
  client.initialize();
});

declare module "nitropack" {
  interface NitroApp {
    configDirectorClient: ConfigDirectorClient;
  }
}
