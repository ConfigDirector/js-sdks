import type { ConfigState, ConnectionMode } from "./types";
import { decodeNativeValue, type NativeValues } from "./native-values";

type BrowserHalfSource = "as-given" | "inherit-offline" | "connect";

export const decideBrowserHalfSource = (
  browserHalf: { mode?: ConnectionMode; values?: NativeValues },
  serverConnectionMode: ConnectionMode | undefined,
): BrowserHalfSource => {
  if (browserHalf.mode !== undefined || browserHalf.values !== undefined) {
    return "as-given";
  }
  if (serverConnectionMode === "offline") {
    return "inherit-offline";
  }
  return "connect";
};

const holdsAValue = (config: ConfigState): config is ConfigState & { value: string } =>
  typeof config.value === "string";

export const offlineValuesOf = (configs: Record<string, ConfigState>): NativeValues =>
  Object.fromEntries(
    Object.values(configs)
      .filter(holdsAValue)
      .map((config) => [config.key, decodeNativeValue(config.type, config.value)]),
  );
