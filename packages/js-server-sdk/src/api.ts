import type { ConfigDirectorLoggingLevel, ConfigDirectorLogMessageDecorator } from "@shared/types";
import { DefaultConfigDirectorClient } from "./DefaultConfigDirectorClient";
import type { ConfigDirectorClient, ConfigDirectorClientOptions } from "./types";
import { createDefaultLogger } from "./logger";

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
export const createClient = (
  serverSdkKey: string,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient => {
  return new DefaultConfigDirectorClient(
    serverSdkKey,
    { sdkName: "js-server-sdk", sdkVersion: "__VERSION__" },
    clientOptions,
  );
};

export const createConsoleLogger = (
  level: ConfigDirectorLoggingLevel,
  messageDecorator?: ConfigDirectorLogMessageDecorator,
) => {
  return createDefaultLogger(level, messageDecorator);
};
