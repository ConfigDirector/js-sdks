import type { ConfigDirectorClient } from "@js-client-core/types";
import { useNuxtApp } from "#app";

export const useClient = (): { client: ConfigDirectorClient } => {
  const { $configDirectorClient } = useNuxtApp();
  return { client: $configDirectorClient as ConfigDirectorClient };
};
