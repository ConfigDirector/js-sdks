import {
  type ConfigDirectorClient,
  type ConfigDirectorClientOptions,
  DefaultConfigDirectorClient,
} from "@js-client-core/index";
import { resolveMetadata } from "./appInfo";
import { asyncStorageInstanceIdStorage } from "./instanceIdStorage";
import { createConsoleLogger } from "./logger";
import { reactNativeStreamingFetch } from "./reactNativeStreamingFetch";
import { ReactNativeTelemetryClient } from "./ReactNativeTelemetryClient";
import { urlFactory } from "./url";

export const createClient = (
  clientSdkKey: string,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient => {
  const sdkIdentity = { sdkName: "react-native-sdk", sdkVersion: "__VERSION__" };
  const logger = clientOptions?.logger ?? createConsoleLogger("warn");
  const metadata = resolveMetadata(clientOptions?.metadata, logger);
  return new DefaultConfigDirectorClient(
    (liveTelemetry) =>
      new ReactNativeTelemetryClient({
        sdkKey: liveTelemetry.clientSdkKey,
        sdkIdentity,
        metaContext: metadata,
        baseUrl: liveTelemetry.baseUrl,
        logger,
        urlFactory,
      }),
    clientSdkKey,
    sdkIdentity,
    { ...clientOptions, logger, metadata },
    {
      fetch: reactNativeStreamingFetch,
      urlFactory,
      instanceIdStorage: asyncStorageInstanceIdStorage(logger),
    },
  );
};
