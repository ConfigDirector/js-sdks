import type { ConfigDirectorLogger } from "@shared/types";
import { CACHED_VALUES_STORAGE_KEY_PREFIX } from "@js-client-core/cached-values";

export const sleep = async (time: number) => await new Promise<void>((r) => setTimeout(() => r(), time));

export const SSE_URL = "https://client-sdk-api.configdirector.com/client/sse/v1" as const;
export const POLLING_URL = "https://client-sdk-api.configdirector.com/client/polling/v1" as const;
export const TELEMETRY_URL = "https://client-sdk-api.configdirector.com/client/telemetry/v1" as const;
export const BASE_URL = "https://client-sdk-api.configdirector.com/" as const;

export const createStubbedLogger = (): ConfigDirectorLogger => {
  return {
    debug: function (): void {},
    info: function (): void {},
    warn: function (): void {},
    error: function (): void {},
  };
};

export const forgetCachedValues = () => {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(CACHED_VALUES_STORAGE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
};
