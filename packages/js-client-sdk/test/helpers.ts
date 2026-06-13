import type { ConfigDirectorLogger } from "@shared/types";

export const sleep = async (time: number) => await new Promise<void>((r) => setTimeout(() => r(), time));

export const SSE_URL = "https://client-sdk-api.configdirector.com/client/sse/v1" as const;
export const POLL_URL = "https://client-sdk-api.configdirector.com/client/polling/v1" as const;
export const BASE_URL = "https://client-sdk-api.configdirector.com/" as const;

export const createStubbedLogger = (): ConfigDirectorLogger => {
  return {
    debug: function (): void {},
    info: function (): void {},
    warn: function (): void {},
    error: function (): void {},
  };
};
