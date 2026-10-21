import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { toRaw, shallowRef, readonly } from "vue";
import { createBrowserClient } from "@js-browser-client/index";
import { readInstalledTestClient } from "@js-client-core/installedTestClient";
import { decideMountAction } from "@js-client-core/mountAction";
import type {
  ConfigDirectorClient,
  ConfigDirectorLogger,
  ConnectionMode,
  OfflineValues,
} from "@js-client-core/types";
import { decideBrowserHalfSource } from "@shared/browser-half";
import { useConfigDirectorContext } from "./app/composables/useConfigDirectorContext";
import { createDefaultLogger } from "./logger";
import { OFFLINE_VALUES_ROUTE } from "./offline-values-route";
import { ConfigDirectorInitializationError } from "@shared/errors";
import type { ClientStatus } from "./types";

const DEFAULT_INITIALIZATION_TIMEOUT_MILLISECONDS = 2_000;

export default defineNuxtPlugin(async (nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();
  const logger = createDefaultLogger(runtimeConfig.public?.configdirector?.logLevel);

  const installedTestClient = readInstalledTestClient();
  const client = installedTestClient ?? (await buildClient(runtimeConfig.public?.configdirector, logger));
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

type BrowserHalfConnection = { mode: ConnectionMode | undefined; values: OfflineValues | undefined };

const buildClient = async (
  configdirector: PublicConfigDirectorRuntimeConfig | undefined,
  logger: ConfigDirectorLogger,
): Promise<ConfigDirectorClient> => {
  const browserHalf = await browserHalfConnectionOf(configdirector, logger);
  if (browserHalf.mode !== "offline" && !configdirector?.clientSdkKey) {
    const message =
      "The ConfigDirector clientSdkKey must be configured for the plugin to initialize. You can provide it in nuxt.config.ts under 'runtimeConfig.public.configdirector.clientSdkKey' or as a runtime environment variable named NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY";
    logger.error(message);
    throw new ConfigDirectorInitializationError(message);
  }

  return createBrowserClient(
    configdirector?.clientSdkKey || undefined,
    { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
    {
      metadata: { appName: configdirector?.appName, appVersion: configdirector?.appVersion },
      connection: {
        url: configdirector?.baseUrl || undefined,
        mode: browserHalf.mode,
        values: browserHalf.values,
        pollingInterval: configdirector?.connection?.pollingInterval || undefined,
        timeout: configdirector?.connection?.timeout || DEFAULT_INITIALIZATION_TIMEOUT_MILLISECONDS,
      },
      logger,
    },
  );
};

const browserHalfConnectionOf = async (
  configdirector: PublicConfigDirectorRuntimeConfig | undefined,
  logger: ConfigDirectorLogger,
): Promise<BrowserHalfConnection> => {
  const givenConnection: BrowserHalfConnection = {
    mode: configdirector?.connection?.mode || undefined,
    values: configdirector?.connection?.values,
  };
  const source = decideBrowserHalfSource(givenConnection, configdirector?.serverConnectionMode);
  logger.debug(`Browser half source: ${source}`);
  switch (source) {
    case "as-given":
      return givenConnection;
    case "inherit-offline":
      return { mode: "offline", values: await fetchServerOfflineValues(logger) };
    case "connect":
      return { mode: undefined, values: undefined };
  }
};

const fetchServerOfflineValues = async (logger: ConfigDirectorLogger): Promise<OfflineValues> => {
  try {
    return await $fetch<OfflineValues>(OFFLINE_VALUES_ROUTE);
  }
  catch (error) {
    const message =
      "The server runs ConfigDirector in offline mode, but its values could not be fetched from "
      + `${OFFLINE_VALUES_ROUTE}: ${error instanceof Error ? error.message : String(error)}. A statically `
      + "generated site has no server to serve them; set 'runtimeConfig.public.configdirector.connection' "
      + "to { mode: \"offline\", values } in nuxt.config.ts to give the browser its own values.";
    logger.error(message);
    throw new ConfigDirectorInitializationError(message);
  }
};
