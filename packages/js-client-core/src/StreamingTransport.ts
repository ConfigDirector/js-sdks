import type {
  ConfigDirectorContext,
  ConfigDirectorLogger,
  Transport,
  TransportEvents,
  TransportOptions,
} from "./types";
import { Emitter } from "./Emitter";
import { ConfigDirectorConnectionError } from "./errors";
import { createEventSourceClient } from "@eventsource/index";
import type { EventSourceClient } from "@eventsource/EventSourceClient";
import type { UrlLike } from "@shared/url";

export class StreamingTransport implements Transport {
  private logger: ConfigDirectorLogger;
  private eventSource: EventSourceClient | undefined;
  private eventEmitter = new Emitter<TransportEvents>();
  private url: UrlLike;
  private timeoutTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly options: TransportOptions) {
    this.options = options;
    this.logger = options.logger;
    this.url = options.resolveUrl("client/sse/v1", options.baseUrl);
  }

  public async connect(context: ConfigDirectorContext, timeout: number): Promise<this> {
    if (this.eventSource) {
      this.close();
    }

    const eventSourcePromise = new Promise<this>((resolve, reject) => {
      this.eventSource = createEventSourceClient({
        url: this.url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        fetch: this.options.fetch,
        body: JSON.stringify({
          givenContext: context,
          metaContext: this.options.metaContext,
          clientSdkKey: this.options.clientSdkKey,
          instanceId: this.options.instanceId,
        }),

        onMessage: ({ data }) => {
          this.dispatchMessage(data);
        },
        onConnect: () => {
          this.logger.debug("[StreamingTransport] Connected");
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
          const delay = this.options.connectionRetryDelay(state.attempt);
          const logMessage = `[StreamingTransport] Scheduling reconnect attempt #${state.attempt} in ${delay}ms.`;
          if (state.attempt <= 5) {
            this.logger.info(logMessage);
          } else {
            this.logger.warn(logMessage);
          }
          return delay;
        },
        onError: (error) => {
          this.logger.debug("[StreamingTransport] Error: ", error);
        },
        onDisconnect: () => {
          this.logger.debug("[StreamingTransport] Disconnected");
        },
      });
      this.eventSource.connect();
    });

    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = undefined;
    return Promise.race([
      eventSourcePromise,
      new Promise<this>((resolve) => {
        this.timeoutTimer = setTimeout(() => resolve(this), timeout);
      }),
    ]).finally(() => clearTimeout(this.timeoutTimer));
  }

  private dispatchMessage(data: string) {
    try {
      const json = JSON.parse(data);
      this.eventEmitter.emit("configSetReceived", json);
    } catch (error) {
      this.logger.error("[StreamingTransport] Error parsing and dispatching config data update: ", error);
    }
  }

  private prepareFatalError(
    responseStatus: number | undefined,
    error: Error | undefined,
  ): ConfigDirectorConnectionError {
    const status = responseStatus ?? 0;
    const headline = `Connection failed with status: ${responseStatus ?? "unknown"}.`;
    const errorLine = error ? ` Error: ${error}` : "";
    const message = `${headline}${errorLine}. This is an unrecoverable error, will not attempt to reconnect.`;
    return new ConfigDirectorConnectionError(message, status);
  }

  private isStatusFatal(status: number | undefined): boolean {
    return !!status && status >= 400 && status < 500;
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
    this.eventEmitter.off(name, handler);
  }

  public clear(): void {
    this.eventEmitter.clear();
  }

  public close() {
    this.eventSource?.close();
    clearTimeout(this.timeoutTimer);
  }

  public dispose(): void {
    this.close();
    this.clear();
  }
}
