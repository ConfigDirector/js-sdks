import type { ConfigDirectorLogger } from "@shared/types";

export const SSE_URL = "https://server-sdk-api.configdirector.com/server/sse/v1" as const;
export const POLLING_URL = "https://server-sdk-api.configdirector.com/server/polling/v1" as const;

export const createStubbedLogger = (): ConfigDirectorLogger => {
  return {
    debug: function (): void {},
    info: function (): void {},
    warn: function (): void {},
    error: function (): void {},
  };
};
