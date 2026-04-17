import type { ConfigDirectorLogger } from "@shared/types";

export const SSE_URL = "https://client-sdk-api.configdirector.com/client/sse/v1" as const;

export const createStubbedLogger = (): ConfigDirectorLogger => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});
