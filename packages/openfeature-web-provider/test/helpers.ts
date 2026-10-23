import { vi } from "vitest";
import type { ConfigDirectorLogger } from "@shared/types";
import { CACHED_VALUES_STORAGE_KEY_PREFIX } from "@js-client-core/cached-values";

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

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

export const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

export const forgetCachedValues = () => {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(CACHED_VALUES_STORAGE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
};
