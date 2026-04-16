import type {
  ConfigBundle,
  ConfigDirectorLogger,
  Transport,
  TransportEvents,
  TransportOptions,
} from "./types";
import { ConfigDirectorConnectionError } from "@shared/errors";
import { EventEmitter } from "node:events";
import { createEventSourceClient } from "@eventsource/index";
import type { EventSourceClient } from "@eventsource/EventSourceClient";

const MAX_EXPONENTIAL_DELAY = 9; // 2^9 = 512 seconds, to cap it to under 10min

export class StreamingTransport implements Transport {
  private logger: ConfigDirectorLogger;
  private eventSource: EventSourceClient | undefined;
  private eventEmitter = new EventEmitter();
  private url: URL;

  constructor(private readonly options: TransportOptions) {
    this.options = options;
    this.logger = options.logger;
    this.url = new URL("server/sse/v1", options.baseUrl);
  }

  public async connect(timeout: number): Promise<this> {
    if (this.eventSource) {
      this.close();
    }

    const eventSourcePromise = new Promise<this>((resolve, reject) => {
      this.eventSource = createEventSourceClient({
        url: this.url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaContext: this.options.metaContext,
          serverSdkKey: this.options.serverSdkKey,
        }),

        onMessage: ({ data }) => {
          this.dispatchMessage(data);
        },
        onConnect: () => {
          this.logger.debug("[EventSourceTransport] Connected");
          resolve(this);
        },
        shouldReconnect: (state) => {
          const reconnect = !this.isStatusFatal(state.status);
          if (!reconnect) {
            reject(this.prepareFatalError(state.status, state.error));
          }
          return reconnect;
        },
        calculateReconnectDelay: (state) => {
          const seconds = Math.pow(2, Math.min(state.attempt, MAX_EXPONENTIAL_DELAY));
          const delay = seconds * 1_000;
          this.logger.warn(`[EventSourceTransport] Scheduling reconnect in ${delay}ms.`);
          return delay;
        },
        onDisconnect: () => {
          this.logger.debug("[EventSourceTransport] Disconnected");
        },
      });
      this.eventSource.connect();
    });
    return Promise.race([
      eventSourcePromise,
      new Promise<this>((resolve) => {
        setTimeout(() => resolve(this), timeout);
      }),
    ]);
  }

  private dispatchMessage(data: string) {
    try {
      const json = JSON.parse(data);
      this.eventEmitter.emit("configBundleReceived", json as ConfigBundle);
    } catch (error) {
      this.logger.error("[EventSourceTransport] Error parsing and dispatching config data update: ", error);
    }
  }

  private prepareFatalError(
    responseStatus: number | undefined,
    error: Error | undefined,
  ): ConfigDirectorConnectionError {
    const status = responseStatus ?? 0;
    const headline = `Connection failed with status: ${responseStatus ?? "unknown"}.`;
    const errorLine = error ? ` Error: ${error}.` : "";
    const message = `${headline}${errorLine} This is an unrecoverable error, will not attempt to reconnect.`;
    return new ConfigDirectorConnectionError(message, status);
  }

  private isStatusFatal(status: number | undefined): boolean {
    return !!status && status >= 400 && status < 500;
  }

  public get isConnected(): boolean {
    return this.eventSource?.readyState == "open";
  }

  public on<TName extends keyof TransportEvents>(
    name: TName,
    handler: (payload: TransportEvents[TName]) => void,
  ): void {
    this.eventEmitter.on(name, handler);
  }

  public off<TName extends keyof TransportEvents>(
    name: TName,
    handler?: ((payload: TransportEvents[TName]) => void) | undefined,
  ): void {
    if (handler) {
      this.eventEmitter.off(name, handler);
    } else {
      this.eventEmitter.removeAllListeners(name);
    }
  }

  public clear(): void {
    this.eventEmitter.removeAllListeners();
  }

  public close() {
    this.eventSource?.close();
  }

  public dispose(): void {
    this.close();
    this.clear();
  }
}
