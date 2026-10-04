import { vi } from "vitest";
import type { ConfigDirectorLogger } from "@shared/types";

export const sleep = async (time: number) => await new Promise<void>((r) => setTimeout(() => r(), time));

export const SSE_URL = "https://client-sdk-api.configdirector.com/client/sse/v1" as const;
export const POLLING_URL = "https://client-sdk-api.configdirector.com/client/polling/v1" as const;
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

export const removeWorker = () => {
  const RealWorker = globalThis.Worker;
  Reflect.deleteProperty(globalThis, "Worker");
  return () =>
    Object.defineProperty(globalThis, "Worker", { value: RealWorker, writable: true, configurable: true });
};

export const throwOnWorkerConstruction = (attempts = { count: 0 }) => {
  vi.stubGlobal("Worker", function () {
    attempts.count++;
    throw new DOMException("The operation is insecure.", "SecurityError");
  });
  return () => vi.unstubAllGlobals();
};

export const captureUnhandledRejections = () => {
  const reasons: unknown[] = [];
  const listener = (event: PromiseRejectionEvent) => reasons.push(event.reason);
  window.addEventListener("unhandledrejection", listener);
  return {
    reasons,
    stop: () => window.removeEventListener("unhandledrejection", listener),
  };
};

export const hidePageFor = async (duration: number) => {
  const visibilityState = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  try {
    document.dispatchEvent(new Event("visibilitychange"));
    await sleep(duration);
  } finally {
    visibilityState.mockRestore();
  }
};
