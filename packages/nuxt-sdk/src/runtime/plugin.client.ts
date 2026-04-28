import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { toRaw, shallowRef, readonly } from "vue";
import { createBrowserClient } from "@js-browser-client/index";
import { useContext } from "./app/composables/useContext";
import { createDefaultLogger } from "./logger";
import { ConfigDirectorInitializationError } from "@shared/errors";
import type { ClientStatus } from "./types";

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();
  const logger = createDefaultLogger(
    runtimeConfig.public?.configdirector?.logLevel ?? "warn",
  );

  if (!runtimeConfig.public?.configdirector?.clientSdkKey) {
    throw new ConfigDirectorInitializationError(
      "The ConfigDirector clientSdkKey must be configured for the plugin to initialize",
    );
  }

  logger.debug("Installed ConfigDirector Nuxt plugin");

  const client = createBrowserClient(
    runtimeConfig.public.configdirector.clientSdkKey,
    { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
    {
      metadata: {
        appName: runtimeConfig.public.configdirector.appName,
        appVersion: runtimeConfig.public.configdirector.appVersion,
      },
      connection: {
        timeout: 2_000,
      },
      logger,
    },
  );

  const readyStatus = shallowRef<ClientStatus>(client.isReady ? "ready" : "loading");
  client.on("clientReady", () => {
    readyStatus.value = "ready";
  });
  nuxtApp.hooks.hook("app:created", async () => {
    logger.debug(`Initializing browser client`);
    const { context } = useContext();
    await client.initialize(toRaw(context));
    if (!client.isReady) {
      readyStatus.value = "default";
    }
    logger.debug(
      `Browser client initialization awaited, ready status: ${client.isReady}`,
    );
  });

  return {
    provide: {
      configDirectorClient: client,
      configDirectorClientReadyStatus: readonly(readyStatus),
    },
  };
});
