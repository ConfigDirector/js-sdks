import type {
  ConfigDirectorClient,
  ConfigDirectorClientOptions,
  ConfigDirectorLoggingLevel,
  ConfigDirectorLogMessageDecorator,
  OfflineClientOptions,
} from "@js-browser-client/index";
import { createBrowserClient, createDefaultLogger } from "@js-browser-client/index";

const SDK_IDENTITY = { sdkName: "js-client-sdk", sdkVersion: "__VERSION__" };

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
export function createClient(clientSdkKey: string, clientOptions?: ConfigDirectorClientOptions): ConfigDirectorClient;
/**
 * Creates a `ConfigDirectorClient` in `offline` mode, which needs no client SDK key. The client
 * never connects to ConfigDirector: it serves `connection.values` to every context, or the in-code
 * default values when none are given. `initialize` rejects with a `ConfigDirectorInitializationError`
 * when the values cannot be loaded.
 *
 * @param clientOptions {@link OfflineClientOptions} options for the client, with `connection.mode`
 * set to `offline`
 * @returns A {@link ConfigDirectorClient} object
 *
 * @example
 * import { createClient } from "@configdirector/client-sdk";
 * const client = createClient({ connection: { mode: "offline", values: { "new-checkout": true } } });
 * await client.initialize();
 */
export function createClient(clientOptions: OfflineClientOptions): ConfigDirectorClient;
export function createClient(
  clientSdkKeyOrOptions: string | OfflineClientOptions,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient {
  return createBrowserClient(clientSdkKeyOrOptions, SDK_IDENTITY, clientOptions);
}

export const createConsoleLogger = (
  level: ConfigDirectorLoggingLevel,
  messageDecorator?: ConfigDirectorLogMessageDecorator,
) => {
  return createDefaultLogger(level, messageDecorator);
};
