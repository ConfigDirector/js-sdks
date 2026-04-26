import {
  type ConfigDirectorClientOptions,
  type ConfigDirectorClient,
  type IdentifyingSdkOptions,
  type TelemetryClient,
  createDefaultLogger,
  type ConfigDirectorContext,
  type ConfigValueType,
  type EvaluatedConfigEvent,
  type ClientEvents,
  type WatchHandler,
} from "@js-client-core/index";
import { DefaultConfigDirectorClient } from "@js-client-core/DefaultConfigDirectorClient";
import type { ConfigDirectorClient as ServerConfigDirectorClient } from "@configdirector/server-sdk";
import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { useContext } from "./app/composables/useContext";

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();

  console.log("ConfigDirector plugin is in SSR");

  const serverClient = nuxtApp.ssrContext?.event?.context.configDirectorClient
  console.log("Nitro ConfigDirector client isReady: ", serverClient?.isReady);
  if (!serverClient) {
    throw "The nitro ConfigDirector plugin was not initialized";
  }

  const client: ConfigDirectorClient = createSsrClient(serverClient);

  nuxtApp.hooks.hook("app:created", async () => {
    console.info(`[@configdirector/nuxt-sdk] Initializing SSR client`);
    const { context } = useContext();
    await client.initialize(context);
    console.info(
      `[@configdirector/nuxt-sdk] SSR initialization awaited, ready status: ${client.isReady}`,
    );
  });

  return {
    provide: {
      configDirectorClient: client,
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
    return this.serverClient.getValue(configKey, defaultValue, this.currentContext);
  }

  watch<T extends ConfigValueType>(configKey: string, defaultValue: T, callback: WatchHandler<T>): () => void {
    return this.serverClient.watch(configKey, defaultValue, callback, this.currentContext);
  }

  unwatch<T extends ConfigValueType>(configKey: string, callback?: WatchHandler<T>): void {
    return this.serverClient.unwatch(configKey, callback);
  }

  unwatchAll(): void {
    return this.serverClient.unwatchAll();
  }

  pauseNetwork(): void {
  }

  async resumeNetwork(): Promise<void> {
  }

  dispose(): void {
  }

  on<TName extends keyof ClientEvents>(name: TName, handler: (payload: ClientEvents[TName]) => void): void {
    throw new Error("Method not implemented.");
  }

  off<TName extends keyof ClientEvents>(name: TName, handler?: ((payload: ClientEvents[TName]) => void) | undefined): void {
    throw new Error("Method not implemented.");
  }

  clear(): void {
  }
}

const createSsrClient = (serverClient: ServerConfigDirectorClient): ConfigDirectorClient => {

  return new SsrClient(serverClient);
};

class SsrTelemetryClient implements TelemetryClient {
  async updateContext(value: ConfigDirectorContext | undefined): Promise<void> {}
  evaluatedConfig<T extends ConfigValueType>(event: EvaluatedConfigEvent<T>): void {}
  async close(): Promise<void> {}
}
