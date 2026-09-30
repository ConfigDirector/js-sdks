import type { ConfigDirectorClient } from "@js-client-core/index";
import { readInstalledTestClient } from "@js-client-core/installedTestClient";
import { createClient } from "./client";
import { createConsoleLogger } from "./logger";
import type { ConfigDirectorProviderOptions, ConfigDirectorProviderProps } from "./types";

export type ClientSource = { client: ConfigDirectorClient; owned: boolean };

export const buildClient = (options: ConfigDirectorProviderOptions): ConfigDirectorClient =>
  createClient(options.sdkKey, {
    connection: {
      url: options.url,
      timeout: options.timeout,
      mode: options.mode,
      pollingInterval: options.pollingInterval,
    },
    metadata: { appName: options.appName, appVersion: options.appVersion },
    logger: options.logger ?? createConsoleLogger("warn"),
    hooks: options.hooks,
  });

export const hasGivenClient = (props: ConfigDirectorProviderProps): props is { client: ConfigDirectorClient } =>
  "client" in props && props.client !== undefined;

export const resolveClientSource = (props: ConfigDirectorProviderProps): ClientSource => {
  if (hasGivenClient(props)) {
    return { client: props.client, owned: false };
  }
  const installed = readInstalledTestClient();
  if (installed) {
    return { client: installed, owned: false };
  }
  return { client: buildClient(props), owned: true };
};
