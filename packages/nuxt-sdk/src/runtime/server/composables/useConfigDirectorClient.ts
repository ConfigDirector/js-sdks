import type { ConfigDirectorClient } from "@js-server-sdk/types";
import { useNitroApp } from "nitropack/runtime";

export const useConfigDirectorClient = (): ConfigDirectorClient => {
  const serverSdkClient = useNitroApp().configDirectorClient;
  if (!serverSdkClient) {
    throw "The nitro ConfigDirector plugin was not initialized";
  }
  return serverSdkClient;
};
