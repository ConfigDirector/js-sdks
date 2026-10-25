import {
  type ConfigDirectorClientOptions,
  type ConfigDirectorClient,
  type IdentifyingSdkOptions,
  type OfflineClientOptions,
} from "@js-client-core/index";
import { WebWorkerTelemetryClient } from "./telemetry/WebWorkerTelemetryClient";
import { DefaultConfigDirectorClient } from "@js-client-core/DefaultConfigDirectorClient";
import { defaultUrlFactory } from "@shared/url";
import { generateValueId } from "./telemetry/value-id-generator";
import { localStorageCachingProvider } from "./local-storage-caching-provider";

/**
 * Creates a browser client. With a client SDK key it connects to ConfigDirector; with
 * {@link OfflineClientOptions} alone it runs in `offline` mode and serves `connection.values`. An
 * absent key with `clientOptions` is the same as the options alone when their mode is `offline`,
 * and fails like a missing key otherwise.
 */
export const createBrowserClient = (
  clientSdkKeyOrOptions: string | OfflineClientOptions | undefined,
  sdkOptions: IdentifyingSdkOptions,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient => {
  return DefaultConfigDirectorClient.from(
    ({ clientSdkKey, baseUrl, logger, metadata, clientSession }) =>
      new WebWorkerTelemetryClient({
        sdkKey: clientSdkKey,
        sdkIdentity: {
          sdkName: sdkOptions.sdkName,
          sdkVersion: sdkOptions.sdkVersion,
        },
        metaContext: {
          appName: metadata?.appName,
          appVersion: metadata?.appVersion,
        },
        logger,
        baseUrl,
        urlFactory: defaultUrlFactory,
        valueIdGenerator: generateValueId,
        clientSession,
      }),
    clientSdkKeyOrOptions,
    sdkOptions,
    clientOptions,
    { platformCachingProvider: localStorageCachingProvider },
  );
};
