import type { ConfigState, ConnectionMode, OfflineValues } from "@js-server-sdk/types";
import { decodeNativeValue } from "@shared/native-values";

type BrowserHalfSource = "as-given" | "inherit-offline" | "connect";

export const decideBrowserHalfSource = (
  browserProps: { mode?: ConnectionMode; values?: OfflineValues },
  serverConnectionMode: ConnectionMode | undefined,
): BrowserHalfSource => {
  if (browserProps.mode !== undefined || browserProps.values !== undefined) {
    return "as-given";
  }
  if (serverConnectionMode === "offline") {
    return "inherit-offline";
  }
  return "connect";
};

const holdsAValue = (config: ConfigState): config is ConfigState & { value: string } =>
  typeof config.value === "string";

export const offlineValuesOf = (configs: Record<string, ConfigState>): OfflineValues =>
  Object.fromEntries(
    Object.values(configs)
      .filter(holdsAValue)
      .map((config) => [config.key, decodeNativeValue(config.type, config.value)]),
  );
