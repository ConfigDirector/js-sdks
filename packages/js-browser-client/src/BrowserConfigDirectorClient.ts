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

/**
 * Creates a browser client. With a client SDK key it connects to ConfigDirector; with
 * {@link OfflineClientOptions} alone it runs in `offline` mode and serves `connection.values`.
 */
export const createBrowserClient = (
  clientSdkKeyOrOptions: string | OfflineClientOptions,
  sdkOptions: IdentifyingSdkOptions,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient => {
  return DefaultConfigDirectorClient.from(
    ({ clientSdkKey, baseUrl, logger, metadata }) =>
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
      }),
    clientSdkKeyOrOptions,
    sdkOptions,
    clientOptions,
  );
};
