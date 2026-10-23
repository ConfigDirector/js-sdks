import type {
  ConfigDirectorClient,
  ConfigDirectorContext,
  ConfigValueType,
} from "@js-client-core/index";
import { createDefaultLogger } from "./logger";
import type { ConfigDirectorClient as ServerConfigDirectorClient } from "@configdirector/server-sdk";
import { shallowRef, readonly } from "vue";
import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { useConfigDirectorContext } from "./app/composables/useConfigDirectorContext";
import type { ClientStatus } from "./types";
import type { ClientStartup } from "./client-startup";
import { admittedContextOrNone } from "@shared/context-kind";

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();
  const logger = createDefaultLogger(runtimeConfig.configdirector?.logLevel);

  logger.debug("Installed ConfigDirector Nuxt SSR plugin");

  const serverSdkClient = nuxtApp.ssrContext?.event?.context.configDirectorClient;
  logger.debug("Nitro ConfigDirector client isReady: ", serverSdkClient?.isReady);
  if (!serverSdkClient) {
    throw "The nitro ConfigDirector plugin was not initialized";
  }

  const client: ConfigDirectorClient = createSsrClient(serverSdkClient);
  const readyStatus = shallowRef<ClientStatus>(serverSdkClient.isReady ? "ready" : "default");
  const startup: ClientStartup = { waitsForFirstContext: false, start: (context) => client.initialize(context) };

  nuxtApp.hooks.hook("app:created", async () => {
    logger.debug("Updating ConfigDirector context for SSR evaluation");
    const { context } = useConfigDirectorContext();
    await client.initialize(context.value);
  });

  return {
    provide: {
      configDirectorClient: client,
      configDirectorClientReadyStatus: readonly(readyStatus),
      configDirectorClientStartup: startup,
    },
  };
});

class SsrClient implements ConfigDirectorClient {
  private suppliedContext?: ConfigDirectorContext;

  constructor(private readonly serverClient: ServerConfigDirectorClient) {
    this.serverClient = serverClient;
  }

  async initialize(context?: ConfigDirectorContext): Promise<void> {
    this.suppliedContext = context;
  }

  async updateContext(context: ConfigDirectorContext): Promise<void> {
    this.suppliedContext = context;
  }

  get context(): ConfigDirectorContext | undefined {
    return admittedContextOrNone(this.suppliedContext);
  }

  get isReady(): boolean {
    return this.serverClient.isReady;
  }

  get isInitializing(): boolean {
    return false;
  }

  getValue<T extends ConfigValueType>(configKey: string, defaultValue: T): T {
    return this.serverClient.getValue(configKey, defaultValue, this.suppliedContext);
  }

  watch(): () => void {
    return () => {};
  }

  unwatch(): void {}

  unwatchAll(): void {}

  pauseNetwork(): void {}

  async resumeNetwork(): Promise<void> {}

  dispose(): void {}

  on(): void {}

  off(): void {}

  clear(): void {}
}

const createSsrClient = (serverClient: ServerConfigDirectorClient): ConfigDirectorClient => {
  return new SsrClient(serverClient);
};
