import type {
  ConfigDirectorClient,
  ConfigDirectorClientOptions} from "@js-browser-client/index";
import {
  createBrowserClient,
} from "@js-browser-client/index";

export const createClient = (
  clientSdkKey: string,
  clientOptions?: ConfigDirectorClientOptions,
): ConfigDirectorClient => {
  return createBrowserClient(
    clientSdkKey,
    { sdkName: "react-web-sdk", sdkVersion: "__VERSION__" },
    clientOptions,
  );
};

