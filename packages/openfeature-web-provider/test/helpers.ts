import { vi } from "vitest";
import type { ConfigDirectorLogger } from "@shared/types";

export const SSE_URL = "https://client-sdk-api.configdirector.com/client/sse/v1" as const;
export const POLL_URL = "https://client-sdk-api.configdirector.com/client/polling/v1" as const;

export const createStubbedLogger = (): ConfigDirectorLogger => {
  return {
    debug: function (): void {},
    info: function (): void {},
    warn: function (): void {},
    error: function (): void {},
  };
};

export const createCapturingLogger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
