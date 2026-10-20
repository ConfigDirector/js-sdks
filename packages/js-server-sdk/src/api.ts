import type { ConfigDirectorLoggingLevel, ConfigDirectorLogMessageDecorator } from "@shared/types";
import { DefaultConfigDirectorClient } from "./DefaultConfigDirectorClient";
import type { ConfigDirectorClient, ConfigDirectorClientOptions, OfflineClientOptions } from "./types";
import { createDefaultLogger } from "./logger";

const SDK_IDENTITY = { sdkName: "js-server-sdk", sdkVersion: "__VERSION__" };

/**
 * Instantiates a ConfigDirector client to be used in a server environment. This function returns an
 * uninitialized client and does not make any network calls. You must call {@link ConfigDirectorClient.initialize}
 * before the client is ready to use:
 *
 * @param serverSdkKey string - The ConfigDirector server SDK key. This is a secret value, do not commit it
 * in your source code.
 * @param clientOptions {@link ConfigDirectorClientOptions} - Configuration options for the client (optional).
 * It is recommended that you include the {@link ConfigDirectorClientOptions.metadata} option including your `appName` and `appVersion` in order
 * to use those values in targeting rules.
 * @returns An uninitialized {@link ConfigDirectorClient} instance
 *
 * @example
 *
 * ```
 * import { createClient } from "@configdirector/server-sdk";
 *
 * const client = createClient("YOUR-SERVER-SDK-KEY", {
 *   metadata: { appName: "my-awesome-app", appVersion: "1.0.0" }
 * });
 *
 * await client.initialize();
 * ```
 *
 */
export function createClient(serverSdkKey: string, clientOptions?: ConfigDirectorClientOptions): ConfigDirectorClient;
/**
 * Instantiates a ConfigDirector client in `offline` mode, which needs no server SDK key. The client never
 * connects to ConfigDirector: it serves the values of `connection.file` or `connection.values` to every
 * context, or the in-code default values when neither is given. `initialize` rejects with a
 * `ConfigDirectorInitializationError` when the file or the values cannot be loaded.
 *
 * @param clientOptions {@link OfflineClientOptions} - Configuration options for the client, with
 * `connection.mode` set to `offline`.
 * @returns An uninitialized {@link ConfigDirectorClient} instance
 *
 * @example
 *
 * ```
 * import { createClient } from "@configdirector/server-sdk";
 *
 * const client = createClient({
 *   connection: { mode: "offline", file: "./flags/new-checkout-on.json" },
 * });
 *
 * await client.initialize();
 * ```
 */
export function createClient(clientOptions: OfflineClientOptions): ConfigDirectorClient;
export function createClient(
  serverSdkKeyOrOptions: string | OfflineClientOptions,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient {
  return DefaultConfigDirectorClient.from(serverSdkKeyOrOptions, SDK_IDENTITY, clientOptions);
}

export const createConsoleLogger = (
  level: ConfigDirectorLoggingLevel,
  messageDecorator?: ConfigDirectorLogMessageDecorator,
) => {
  return createDefaultLogger(level, messageDecorator);
};
