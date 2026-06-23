import {
  type ConfigDirectorClientOptions,
  type ConfigDirectorClient,
  type IdentifyingSdkOptions,
  createDefaultLogger,
} from "@js-client-core/index";
import { WebWorkerTelemetryClient } from "./telemetry/WebWorkerTelemetryClient";
import { DefaultConfigDirectorClient } from "@js-client-core/DefaultConfigDirectorClient";
import { defaultUrlFactory, parseUrl } from "@shared/url";
import { CLIENT_BASE_URL } from "@shared/constants";
import { generateValueId } from "./telemetry/value-id-generator";

export const createBrowserClient = (
  clientSdkKey: string,
  sdkOptions: IdentifyingSdkOptions,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient => {
  const logger = clientOptions?.logger ?? createDefaultLogger();
  const baseUrl = parseUrl(clientOptions?.connection?.url) ?? CLIENT_BASE_URL;
  const telemetryClient = new WebWorkerTelemetryClient({
    sdkKey: clientSdkKey,
    logger: logger,
    baseUrl,
    urlFactory: defaultUrlFactory,
    valueIdGenerator: generateValueId
  });

  return new DefaultConfigDirectorClient(telemetryClient, clientSdkKey, sdkOptions, {
    ...clientOptions,
    logger,
  });
};
