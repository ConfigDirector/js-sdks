import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { toRaw, shallowRef, readonly } from "vue";
import { createBrowserClient } from "@js-browser-client/index";
import { readInstalledTestClient } from "@js-client-core/installedTestClient";
import type {
  ConfigDirectorClient,
  ConfigDirectorContext,
  ConfigDirectorLogger,
  ConnectionMode,
  OfflineValues,
} from "@js-client-core/types";
import { decideBrowserHalfSource } from "@shared/browser-half";
import { useConfigDirectorContext } from "./app/composables/useConfigDirectorContext";
import { decideStartupAction } from "./client-startup";
import type { ClientStartup } from "./client-startup";
import { createDefaultLogger } from "./logger";
import { OFFLINE_VALUES_ROUTE } from "./offline-values-route";
import { ConfigDirectorInitializationError } from "@shared/errors";
import type { ClientStatus } from "./types";

const DEFAULT_INITIALIZATION_TIMEOUT_MILLISECONDS = 2_000;

export default defineNuxtPlugin(async (nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();
  const configdirector = runtimeConfig.public?.configdirector;
  const logger = createDefaultLogger(configdirector?.logLevel);

  const installedTestClient = readInstalledTestClient();
  const { client, runsOffline } = installedTestClient
    ? { client: installedTestClient, runsOffline: false }
    : await buildClient(configdirector, logger);
  logger.debug(installedTestClient ? "Installed ConfigDirector Nuxt plugin with a test client" : "Installed ConfigDirector Nuxt plugin");

  const readyStatus = shallowRef<ClientStatus>(client.isReady ? "ready" : "loading");
  client.on("clientReady", () => {
    readyStatus.value = "ready";
  });
  const settleReadyStatus = () => {
    if (!client.isReady) {
      readyStatus.value = "default";
    }
  };
  const startup: ClientStartup = {
    waitsForFirstContext: configdirector?.deferInitialization === true && !runsOffline,
    start: async (context) => {
      await client.initialize(context);
      settleReadyStatus();
    },
  };

  nuxtApp.hooks.hook("app:created", async () => {
    const { context } = useConfigDirectorContext();
    const rawContext = toRaw(context.value);
    const startupAction = decideStartupAction(client, rawContext, startup.waitsForFirstContext);
    logger.debug(`Browser client startup action: ${startupAction}`);
    switch (startupAction) {
      case "waitForContext":
        return;
      case "firstStartInFlight":
        return;
      case "initialize":
        await client.initialize(rawContext);
        break;
      case "updateContext":
        await client.updateContext(rawContext as ConfigDirectorContext);
        break;
      case "none":
        break;
    }
    settleReadyStatus();
    logger.debug(`Browser client startup action awaited, ready status: ${client.isReady}`);
  });

  return {
    provide: {
      configDirectorClient: client,
      configDirectorClientReadyStatus: readonly(readyStatus),
      configDirectorClientStartup: startup,
    },
  };
});

type PublicConfigDirectorRuntimeConfig = ReturnType<typeof useRuntimeConfig>["public"]["configdirector"];

type BrowserHalfConnection = { mode: ConnectionMode | undefined; values: OfflineValues | undefined };

type BuiltClient = { client: ConfigDirectorClient; runsOffline: boolean };

const buildClient = async (
  configdirector: PublicConfigDirectorRuntimeConfig | undefined,
  logger: ConfigDirectorLogger,
): Promise<BuiltClient> => {
  const browserHalf = await browserHalfConnectionOf(configdirector, logger);
  if (browserHalf.mode !== "offline" && !configdirector?.clientSdkKey) {
    const message =
      "The ConfigDirector clientSdkKey must be configured for the plugin to initialize. You can provide it in nuxt.config.ts under 'runtimeConfig.public.configdirector.clientSdkKey' or as a runtime environment variable named NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY";
    logger.error(message);
    throw new ConfigDirectorInitializationError(message);
  }

  const client = createBrowserClient(
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
  return { client, runsOffline: browserHalf.mode === "offline" };
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
