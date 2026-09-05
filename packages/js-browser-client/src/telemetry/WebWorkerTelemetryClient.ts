import { type TelemetryEventCollectorOptions } from "@shared/telemetry/TelemetryEventCollector";
import type { ConfigDirectorContext, ConfigDirectorLogger, ConfigValueType } from "@js-client-core/types";
import type { TelemetryClient, EvaluatedConfigEvent } from "@js-client-core/telemetry";
import type {
  TelemetryCloseEvent,
  TelemetryEvaluatedConfigEvent,
  TelemetryFlushEvent,
  TelemetryInitializeEvent,
  TelemetryUpdateContextEvent,
  TelemetryWorkerResponseEvent,
} from "./types";
import type { TelemetryValue } from "@shared/telemetry/utils";
import { mapToTelemetryValue } from "@shared/telemetry/utils";

const DEFAULT_WORKER_CLOSE_TIMEOUT = 6_000;

export type WebWorkerTelemetryClientOptions = TelemetryEventCollectorOptions & {
  workerCloseTimeout?: number;
};

export class WebWorkerTelemetryClient implements TelemetryClient {
  private readonly logger: ConfigDirectorLogger;
  private worker: Worker;
  private closePromise: Promise<void> | undefined;
  private closeResolve: (() => void) | undefined;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly workerCloseTimeout: number;
  private readonly visibilityHandler: () => void;

  constructor(options: WebWorkerTelemetryClientOptions) {
    this.logger = options.logger;
    this.workerCloseTimeout = options.workerCloseTimeout ?? DEFAULT_WORKER_CLOSE_TIMEOUT;

    const initializeMessage: TelemetryInitializeEvent = {
      type: "Initialize",
      payload: {
        sdkKey: options.sdkKey,
        sdkIdentity: options.sdkIdentity,
        baseUrl: options.baseUrl.toString(),
        evaluationQueueLimit: options.evaluationQueueLimit ?? 1_000,
        initialFlushIntervalDelay: options.initialFlushIntervalDelay ?? 5_000,
        flushIntervalDelay: options.flushIntervalDelay ?? 30_000,
      },
    };
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (message: MessageEvent<TelemetryWorkerResponseEvent>) => {
      this.handleWorkerEvent(message.data);
    };
    this.worker.postMessage(initializeMessage);

    this.visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        this.flush();
      }
    };
    try {
      document.addEventListener("visibilitychange", this.visibilityHandler);
    } catch (error) {
      this.logger.warn("[TelemetryEventCollector] Could not configure 'visibilitychange' listener: ", error);
    }
  }

  public async updateContext(value: ConfigDirectorContext | undefined) {
    const updateContextMessage: TelemetryUpdateContextEvent = {
      type: "UpdateContext",
      payload: {
        context: value,
      },
    };
    this.worker.postMessage(updateContextMessage);
  }

  public evaluatedConfig<T extends ConfigValueType>(event: EvaluatedConfigEvent<T>): void {
    const evaluatedConfigMessage: TelemetryEvaluatedConfigEvent = {
      type: "EvaluatedConfigEvent",
      payload: this.sanitizeEvaluatedConfigEvent(event),
    };
    this.worker.postMessage(evaluatedConfigMessage);
  }

  private sanitizeEvaluatedConfigEvent<T extends ConfigValueType>(
    event: EvaluatedConfigEvent<T>,
  ): EvaluatedConfigEvent<TelemetryValue> {
    return {
      ...event,
      defaultValue: mapToTelemetryValue({ value: event.defaultValue, type: event.type }),
      evaluatedValue: mapToTelemetryValue({
        value: event.evaluatedValue,
        valueId: event.evaluatedValueId,
        type: event.type,
      }),
    };
  }

  private handleWorkerEvent(event: TelemetryWorkerResponseEvent) {
    if (event.type === "Closed") {
      this.finishClose();
      return;
    }
    if (!event.payload?.level || !event.payload?.message) {
      return;
    }
    const { level, message, args } = event.payload;

    switch (level) {
      case "debug":
        this.logger.debug(message, ...args);
        break;
      case "info":
        this.logger.info(message, ...args);
        break;
      case "warn":
        this.logger.warn(message, ...args);
        break;
      case "error":
        this.logger.warn(message, ...args);
        break;
    }
  }

  private flush() {
    const flushMessage: TelemetryFlushEvent = {
      type: "Flush",
    };
    this.worker.postMessage(flushMessage);
  }

  public close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }

    return this.performClose();
  }

  private performClose(): Promise<void> {
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    this.closePromise = new Promise<void>((resolve) => {
      this.closeResolve = resolve;
      this.closeTimer = setTimeout(() => {
        this.logger.warn(
          "[WebWorkerTelemetryClient] Timed out waiting for the telemetry worker to close. Terminating the worker.",
        );
        this.finishClose();
      }, this.workerCloseTimeout);
      const closeMessage: TelemetryCloseEvent = { type: "Close" };
      this.worker.postMessage(closeMessage);
    });
    return this.closePromise;
  }

  private finishClose() {
    clearTimeout(this.closeTimer);
    this.closeTimer = undefined;
    this.worker.terminate();
    this.closeResolve?.();
  }
}
