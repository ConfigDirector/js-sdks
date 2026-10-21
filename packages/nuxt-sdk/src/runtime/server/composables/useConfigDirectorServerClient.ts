import type { ConfigDirectorClient } from "@js-server-sdk/types";
import { useNitroApp } from "nitropack/runtime";

export const useConfigDirectorServerClient = (): ConfigDirectorClient => {
  const serverSdkClient = useNitroApp().configDirectorClient;
  if (!serverSdkClient) {
    throw new Error("The ConfigDirector Nitro plugin was not initialized");
  }
  return serverSdkClient;
};
