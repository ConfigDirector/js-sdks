import { vi } from "vitest";
import type { ConfigDirectorLogger } from "@shared/types";
import type { ClientConnectAction, ConfigDirectorContext, ConfigSet, Transport, TransportEvents } from "../src";
import { Emitter } from "../src/Emitter";

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

export const captureUnhandledRejections = () => {
  const reasons: unknown[] = [];
  const listener = (event: PromiseRejectionEvent) => reasons.push(event.reason);
  window.addEventListener("unhandledrejection", listener);
  return {
    reasons,
    stop: () => window.removeEventListener("unhandledrejection", listener),
  };
};

type ConnectCall = { context: ConfigDirectorContext; timeout: number; reason: ClientConnectAction };

export class RecordingTransport implements Transport {
  private emitter = new Emitter<TransportEvents>();
  public connectCalls: ConnectCall[] = [];
  public closeCount = 0;

  async connect(context: ConfigDirectorContext, timeout: number, reason: ClientConnectAction): Promise<this> {
    this.connectCalls.push({ context, timeout, reason });
    return this;
  }

  deliver(configSet: ConfigSet) {
    this.emitter.emit("configSetReceived", configSet);
  }

  on: Transport["on"] = (name, handler) => this.emitter.on(name, handler);
  off: Transport["off"] = (name, handler) => this.emitter.off(name, handler);
  clear = () => this.emitter.clear();
  close = () => {
    this.closeCount++;
  };
  dispose = () => this.close();
}
