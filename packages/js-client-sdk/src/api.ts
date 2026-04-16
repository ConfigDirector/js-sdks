import type {
  ConfigDirectorClient,
  ConfigDirectorClientOptions,
  ConfigDirectorLoggingLevel,
  ConfigDirectorLogMessageDecorator,
} from "@js-browser-client/index";
import { createBrowserClient, createDefaultLogger } from "@js-browser-client/index";
/**
 * Creates a `ConfigDirectorClient` object with the given `clientSdkKey` and optional
 * `clientOptions`. The returned client needs to be initialized before it is ready to serve
 * config values.
 *
 * @param clientSdkKey The client SDK key obtained from the ConfigDirector dashboard
 * @param clientOptions {@link ConfigDirectorClientOptions} options for the client (optional)
 * @returns A {@link ConfigDirectorClient} object
 *
 * @example
 * import { createClient } from "@configdirector/client-sdk";
 * const client = createClient("YOUR-SDK-KEY");
 * await client.initialize();
 */
export const createClient = (
  clientSdkKey: string,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient => {
  return createBrowserClient(
    clientSdkKey,
    { sdkName: "js-client-sdk", sdkVersion: "__VERSION__" },
    clientOptions,
  );
};

export const createConsoleLogger = (
  level: ConfigDirectorLoggingLevel,
  messageDecorator?: ConfigDirectorLogMessageDecorator,
) => {
  return createDefaultLogger(level, messageDecorator);
};
