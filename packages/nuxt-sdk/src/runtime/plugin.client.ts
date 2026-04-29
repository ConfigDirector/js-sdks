import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { toRaw, shallowRef, readonly } from "vue";
import { createBrowserClient } from "@js-browser-client/index";
import { useConfigDirectorContext } from "./app/composables/useConfigDirectorContext";
import { createDefaultLogger } from "./logger";
import { ConfigDirectorInitializationError } from "@shared/errors";
import type { ClientStatus } from "./types";

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();
  const logger = createDefaultLogger(runtimeConfig.public?.configdirector?.logLevel);

  if (!runtimeConfig.public?.configdirector?.clientSdkKey) {
    const message =
      "The ConfigDirector clientSdkKey must be configured for the plugin to initialize. You can provide it in nuxt.config.ts under 'runtimeConfig.public.configdirector.clientSdkKey' or as a runtime environment variable named NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY";
    logger.error(message);
    throw new ConfigDirectorInitializationError(message);
  }

  logger.debug("Installed ConfigDirector Nuxt plugin");

  const { clientSdkKey, appName, appVersion, baseUrl } = runtimeConfig.public.configdirector;
  const client = createBrowserClient(
    clientSdkKey,
    { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
    {
      metadata: { appName, appVersion },
      connection: {
        timeout: 2_000,
        ...(baseUrl ? { url: baseUrl } : {}),
      },
      logger,
    },
  );

  const readyStatus = shallowRef<ClientStatus>(client.isReady ? "ready" : "loading");
  client.on("clientReady", () => {
    readyStatus.value = "ready";
  });
  nuxtApp.hooks.hook("app:created", async () => {
    logger.debug("Initializing browser client");
    const { context } = useConfigDirectorContext();
    await client.initialize(toRaw(context.value));
    if (!client.isReady) {
      readyStatus.value = "default";
    }
    logger.debug(`Browser client initialization awaited, ready status: ${client.isReady}`);
  });

  return {
    provide: {
      configDirectorClient: client,
      configDirectorClientReadyStatus: readonly(readyStatus),
    },
  };
});
