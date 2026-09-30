import type { ConfigDirectorClient, ConfigDirectorContext } from "./types";
import { deepEqual } from "@shared/deepEqual";

export type MountAction = "initialize" | "updateContext" | "none";

export const decideMountAction = (
  client: ConfigDirectorClient,
  context: ConfigDirectorContext | undefined,
): MountAction => {
  if (client.isInitializing) {
    return "none";
  }
  if (!client.isReady) {
    return "initialize";
  }
  if (context !== undefined && !deepEqual(context, client.context)) {
    return "updateContext";
  }
  return "none";
};
