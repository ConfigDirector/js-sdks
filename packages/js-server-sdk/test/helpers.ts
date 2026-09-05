import type { ConfigDirectorLogger } from "@shared/types";

export const sleep = async (time: number) => await new Promise<void>((r) => setTimeout(() => r(), time));

export const SSE_URL = "https://server-sdk-api.configdirector.com/server/sse/v1" as const;
export const POLLING_URL = "https://server-sdk-api.configdirector.com/server/polling/v1" as const;
export const TELEMETRY_URL = "https://server-sdk-api.configdirector.com/server/telemetry/v1";
export const HEARTBEAT_URL = "https://server-sdk-api.configdirector.com/server/heartbeat/v1" as const;
export const BASE_URL = "https://server-sdk-api.configdirector.com/" as const;

export const createStubbedLogger = (): ConfigDirectorLogger => {
  return {
    debug: function (): void {},
    info: function (): void {},
    warn: function (): void {},
    error: function (): void {},
  };
};
