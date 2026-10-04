import { vi } from "vitest";
import type { ConfigDirectorLogger } from "@shared/types";

export const sleep = async (time: number) => await new Promise<void>((r) => setTimeout(() => r(), time));

export const SSE_URL = "https://client-sdk-api.configdirector.com/client/sse/v1" as const;
export const PULL_URL = "https://client-sdk-api.configdirector.com/client/pull/v1" as const;
export const POLL_URL = "https://client-sdk-api.configdirector.com/client/polling/v1" as const;
export const TELEMETRY_URL = "https://client-sdk-api.configdirector.com/client/telemetry/v1";
export const BASE_URL = "https://client-sdk-api.configdirector.com/" as const;

export const createStubbedLogger = (): ConfigDirectorLogger => {
  return {
    debug: function (): void {},
    info: function (): void {},
    warn: function (): void {},
    error: function (): void {},
  };
};

export const createCapturingLogger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });

export const captureUnhandledRejections = () => {
  const reasons: unknown[] = [];
  const listener = (event: PromiseRejectionEvent) => reasons.push(event.reason);
  window.addEventListener("unhandledrejection", listener);
  return {
    reasons,
    stop: () => window.removeEventListener("unhandledrejection", listener),
  };
};
