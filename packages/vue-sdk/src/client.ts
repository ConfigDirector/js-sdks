import type { ConfigDirectorClient, ConfigDirectorClientOptions } from "@js-browser-client/index";
import { createBrowserClient } from "@js-browser-client/index";
import type { ConfigDirectorPluginOptions } from "./types";
import { createConsoleLogger } from "./logger";

export const createClient = (
  clientSdkKey: string,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient => {
  return createBrowserClient(clientSdkKey, { sdkName: "vue-sdk", sdkVersion: "__VERSION__" }, clientOptions);
};

export const createClientFromPluginOptions = (options: ConfigDirectorPluginOptions): ConfigDirectorClient => {
  return createClient(options.sdkKey, {
    connection: { url: options.url, timeout: options.timeout },
    metadata: { appName: options.appName, appVersion: options.appVersion },
    logger: options.logger ?? createConsoleLogger("warn"),
    hooks: options.hooks,
  });
};

export const initializeClient = async (
  options: ConfigDirectorPluginOptions,
): Promise<ConfigDirectorClient> => {
  const client = createClientFromPluginOptions(options);
  await client.initialize(options.context);
  return client;
};
