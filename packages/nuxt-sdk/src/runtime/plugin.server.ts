import {
  type ConfigDirectorClient,
  type ConfigDirectorContext,
  type ConfigValueType,
  type ClientEvents,
  type WatchHandler,
} from "@js-client-core/index";
import { createDefaultLogger } from "./logger";
import type { ConfigDirectorClient as ServerConfigDirectorClient } from "@configdirector/server-sdk";
import { shallowRef, readonly } from "vue";
import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { useConfigDirectorContext } from "./app/composables/useConfigDirectorContext";
import type { ClientStatus } from "./types";

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

  nuxtApp.hooks.hook("app:created", async () => {
    logger.debug("Updating ConfigDirector context for SSR evaluation");
    const { context } = useConfigDirectorContext();
    await client.initialize(context.value);
  });

  return {
    provide: {
      configDirectorClient: client,
      configDirectorClientReadyStatus: readonly(readyStatus),
    },
  };
});

class SsrClient implements ConfigDirectorClient {
  private currentContext?: ConfigDirectorContext;

  constructor(private readonly serverClient: ServerConfigDirectorClient) {
    this.serverClient = serverClient;
  }

  async initialize(context?: ConfigDirectorContext): Promise<void> {
    this.currentContext = context;
  }

  async updateContext(context: ConfigDirectorContext): Promise<void> {
    this.currentContext = context;
  }

  get context(): ConfigDirectorContext | undefined {
    return this.currentContext;
  }

  get isReady(): boolean {
    return this.serverClient.isReady;
  }

  get isInitializing(): boolean {
    return false;
  }

  getValue<T extends ConfigValueType>(configKey: string, defaultValue: T): T {
    return this.serverClient.getValue(
      configKey,
      defaultValue,
      this.currentContext,
    );
  }

  watch<T extends ConfigValueType>(
    configKey: string,
    defaultValue: T,
    callback: WatchHandler<T>,
  ): () => void {
    return this.serverClient.watch(
      configKey,
      defaultValue,
      callback,
      this.currentContext,
    );
  }

  unwatch<T extends ConfigValueType>(
    configKey: string,
    callback?: WatchHandler<T>,
  ): void {
    return this.serverClient.unwatch(configKey, callback);
  }

  unwatchAll(): void {
    return this.serverClient.unwatchAll();
  }

  pauseNetwork(): void {}

  async resumeNetwork(): Promise<void> {}

  dispose(): void {}

  on<TName extends keyof ClientEvents>(
    name: TName,
    handler: (payload: ClientEvents[TName]) => void,
  ): void {}

  off<TName extends keyof ClientEvents>(
    name: TName,
    handler?: ((payload: ClientEvents[TName]) => void) | undefined,
  ): void {}

  clear(): void {}
}

const createSsrClient = (
  serverClient: ServerConfigDirectorClient,
): ConfigDirectorClient => {
  return new SsrClient(serverClient);
};
