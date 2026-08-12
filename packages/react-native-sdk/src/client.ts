import {
  type ConfigDirectorClient,
  type ConfigDirectorClientOptions,
  DefaultConfigDirectorClient,
} from "@js-client-core/index";
import { createConsoleLogger } from "./logger";
import { reactNativeStreamingFetch } from "./reactNativeStreamingFetch";
import { ReactNativeTelemetryClient } from "./ReactNativeTelemetryClient";
import { CLIENT_BASE_URL } from "@shared/constants";
import { urlFactory } from "./url";

export const createClient = (
  clientSdkKey: string,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient => {
  const sdkIdentity = { sdkName: "react-native-sdk", sdkVersion: "__VERSION__" };
  const logger = clientOptions?.logger ?? createConsoleLogger("warn");
  const baseUrl = clientOptions?.connection?.url ? urlFactory(clientOptions.connection.url) : CLIENT_BASE_URL;
  const telemetryClient = new ReactNativeTelemetryClient({
    sdkKey: clientSdkKey,
    sdkIdentity,
    baseUrl,
    logger,
    urlFactory,
  });
  return new DefaultConfigDirectorClient(
    telemetryClient,
    clientSdkKey,
    sdkIdentity,
    { ...clientOptions, logger },
    {
      fetch: reactNativeStreamingFetch,
      urlFactory,
    },
  );
};
