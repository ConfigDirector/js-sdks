import { readonly, ref, type InjectionKey, type Ref, type App } from "vue";
import type { ClientStatus, ConfigDirectorPluginOptions } from "./types";
import { createClientFromPluginOptions } from "./client";
import type { ConfigDirectorClient, ConfigDirectorContext } from "@js-client-core/types";

export const ConfigDirectorClientKey: InjectionKey<ConfigDirectorClient> = Symbol("ConfigDirector.Client");
export const ConfigDirectorStatusKey: InjectionKey<Readonly<Ref<ClientStatus>>> = Symbol(
  "ConfigDirector.ClientStatus",
);
export const ConfigDirectorContextKey: InjectionKey<Readonly<Ref<ConfigDirectorContext | undefined>>> =
  Symbol("ConfigDirector.Context");

export const ConfigDirectorPlugin = {
  install: (app: App, optionsOrClient: ConfigDirectorPluginOptions | ConfigDirectorClient) => {
    const client = isClientObject(optionsOrClient)
      ? optionsOrClient
      : createClientFromPluginOptions(optionsOrClient);

    const status = ref<ClientStatus>(client.isReady ? "ready" : "loading");
    const readonlyStatus = readonly(status);
    client.on("clientReady", () => (status.value = "ready"));

    const context = ref<ConfigDirectorContext | undefined>(optionsOrClient.context);
    const readonlyContext = readonly(context);
    client.on("contextUpdated", ({ context: newContext }) => (context.value = newContext));

    if (!client.isReady && !client.isInitializing) {
      client.initialize(optionsOrClient.context).then(() => {
        if (!client.isReady) {
          // The client timed-out initialization and it is serving default values
          status.value = "default";
        }
      });
    }

    app.provide(ConfigDirectorClientKey, client);
    app.provide(ConfigDirectorStatusKey, readonlyStatus);
    app.provide(ConfigDirectorContextKey, readonlyContext);
  },
};

const isClientObject = (options: ConfigDirectorPluginOptions | ConfigDirectorClient): options is ConfigDirectorClient => {
  const candidate = options as Partial<ConfigDirectorClient>;
  return (
    typeof candidate.initialize === "function" &&
    typeof candidate.getValue === "function" &&
    typeof candidate.watch === "function" &&
    typeof candidate.on === "function"
  );
};
