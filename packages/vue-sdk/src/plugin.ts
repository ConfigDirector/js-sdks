import { readonly, ref, type InjectionKey, type Ref, type App } from "vue";
import type { ClientStatus, ConfigDirectorPluginOptions } from "./types";
import { createClient } from "./client";
import { createConsoleLogger } from "./logger";
import type { ConfigDirectorClient, ConfigDirectorContext } from "@js-client-core/types";

export const ConfigDirectorClientKey: InjectionKey<ConfigDirectorClient> = Symbol("ConfigDirector.Client");
export const ConfigDirectorStatusKey: InjectionKey<Readonly<Ref<ClientStatus>>> = Symbol(
  "ConfigDirector.ClientStatus",
);
export const ConfigDirectorContextKey: InjectionKey<Readonly<Ref<ConfigDirectorContext | undefined>>> =
  Symbol("ConfigDirector.Context");

export const ConfigDirectorPlugin = {
  install: (app: App, options: ConfigDirectorPluginOptions) => {
    const client = createClient(options.sdkKey, {
      connection: { url: options.url, timeout: options.timeout },
      metadata: { appName: options.appName, appVersion: options.appVersion },
      logger: options.logger ?? createConsoleLogger("warn"),
    });

    const status = ref<ClientStatus>("loading");
    const readonlyStatus = readonly(status);
    client.on("clientReady", () => (status.value = "ready"));

    const context = ref<ConfigDirectorContext | undefined>(options.context);
    const readonlyContext = readonly(context);
    client.on("contextUpdated", ({ context: newContext }) => (context.value = newContext));

    client.initialize(options.context).then(() => {
      if (!client.isReady) {
        // The client timed-out initialization and it is serving default values
        status.value = "default";
      }
    });

    app.provide(ConfigDirectorClientKey, client);
    app.provide(ConfigDirectorStatusKey, readonlyStatus);
    app.provide(ConfigDirectorContextKey, readonlyContext);
  },
};
