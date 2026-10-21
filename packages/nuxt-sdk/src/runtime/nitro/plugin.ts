import { DefaultConfigDirectorClient } from "@js-server-sdk/DefaultConfigDirectorClient";
import type { ConfigDirectorClient, ConnectionMode } from "@js-server-sdk/types";
import { defineNitroPlugin, useRuntimeConfig } from "nitropack/runtime";
import { createDefaultLogger } from "../logger";
import { ConfigDirectorInitializationError } from "@shared/errors";

export default defineNitroPlugin((nitroApp) => {
  const runtimeConfig = useRuntimeConfig();
  const logger = createDefaultLogger(runtimeConfig.configdirector?.logLevel);
  const { serverSdkKey, baseUrl, connection } = runtimeConfig.configdirector;
  const connectionMode: ConnectionMode = connection?.mode || "streaming";

  if (connectionMode !== "offline" && !serverSdkKey) {
    const message =
      "The ConfigDirector serverSdkKey must be configured for the plugin to initialize. You can provide it in nuxt.config.ts under 'runtimeConfig.configdirector.serverSdkKey' or as a runtime environment variable named NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY";
    logger.error(message);
    throw new ConfigDirectorInitializationError(message);
  }

  logger.debug("Initializing ConfigDirector Nitro plugin");
  const client: ConfigDirectorClient = new DefaultConfigDirectorClient(
    serverSdkKey || undefined,
    { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
    {
      logger,
      connection: {
        url: baseUrl || undefined,
        mode: connectionMode,
        file: connection?.file || undefined,
        values: connection?.values,
        pollingInterval: connection?.pollingInterval || undefined,
        timeout: connection?.timeout || undefined,
      },
    },
  );
  const initialization = client.initialize();
  initialization.catch((error: unknown) => {
    logger.error("The ConfigDirector server client could not initialize, so every request fails:", error);
  });

  nitroApp.configDirectorClient = client;
  nitroApp.configDirectorConnectionMode = connectionMode;
  nitroApp.configDirectorInitialization = initialization;
  nitroApp.hooks.hook("request", (event) => {
    useRuntimeConfig(event).public.configdirector.serverConnectionMode = connectionMode;
  });
});

declare module "nitropack" {
  interface NitroApp {
    configDirectorClient: ConfigDirectorClient;
    configDirectorConnectionMode: ConnectionMode;
    configDirectorInitialization: Promise<void>;
  }
}
