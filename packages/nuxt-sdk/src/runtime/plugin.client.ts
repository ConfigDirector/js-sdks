import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { toRaw, shallowRef, readonly } from "vue";
import { createBrowserClient } from "@js-browser-client/index";
import { readInstalledTestClient } from "@js-client-core/installedTestClient";
import { decideMountAction } from "@js-client-core/mountAction";
import type { ConfigDirectorClient, ConfigDirectorLogger } from "@js-client-core/types";
import { useConfigDirectorContext } from "./app/composables/useConfigDirectorContext";
import { createDefaultLogger } from "./logger";
import { ConfigDirectorInitializationError } from "@shared/errors";
import type { ClientStatus } from "./types";

const DEFAULT_INITIALIZATION_TIMEOUT_MILLISECONDS = 2_000;

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();
  const logger = createDefaultLogger(runtimeConfig.public?.configdirector?.logLevel);

  const installedTestClient = readInstalledTestClient();
  const client = installedTestClient ?? buildClient(runtimeConfig.public?.configdirector, logger);
  logger.debug(installedTestClient ? "Installed ConfigDirector Nuxt plugin with a test client" : "Installed ConfigDirector Nuxt plugin");

  const readyStatus = shallowRef<ClientStatus>(client.isReady ? "ready" : "loading");
  client.on("clientReady", () => {
    readyStatus.value = "ready";
  });
  nuxtApp.hooks.hook("app:created", async () => {
    const { context } = useConfigDirectorContext();
    const rawContext = toRaw(context.value);
    const mountAction = decideMountAction(client, rawContext);
    logger.debug(`Browser client mount action: ${mountAction}`);
    if (mountAction === "initialize") {
      await client.initialize(rawContext);
    }
    else if (mountAction === "updateContext" && rawContext !== undefined) {
      await client.updateContext(rawContext);
    }
    if (!client.isReady) {
      readyStatus.value = "default";
    }
    logger.debug(`Browser client mount action awaited, ready status: ${client.isReady}`);
  });

  return {
    provide: {
      configDirectorClient: client,
      configDirectorClientReadyStatus: readonly(readyStatus),
    },
  };
});

type PublicConfigDirectorRuntimeConfig = ReturnType<typeof useRuntimeConfig>["public"]["configdirector"];

const buildClient = (
  configdirector: PublicConfigDirectorRuntimeConfig | undefined,
  logger: ConfigDirectorLogger,
): ConfigDirectorClient => {
  if (!configdirector?.clientSdkKey) {
    const message =
      "The ConfigDirector clientSdkKey must be configured for the plugin to initialize. You can provide it in nuxt.config.ts under 'runtimeConfig.public.configdirector.clientSdkKey' or as a runtime environment variable named NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY";
    logger.error(message);
    throw new ConfigDirectorInitializationError(message);
  }

  const { clientSdkKey, appName, appVersion, baseUrl, connection } = configdirector;
  return createBrowserClient(
    clientSdkKey,
    { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
    {
      metadata: { appName, appVersion },
      connection: {
        url: baseUrl || undefined,
        mode: connection?.mode || undefined,
        pollingInterval: connection?.pollingInterval || undefined,
        timeout: connection?.timeout || DEFAULT_INITIALIZATION_TIMEOUT_MILLISECONDS,
      },
      logger,
    },
  );
};
