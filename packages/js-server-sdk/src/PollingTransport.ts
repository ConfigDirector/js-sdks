import type {
  ConfigDirectorLogger,
  Transport,
  TransportEvents,
  TransportOptions,
} from "./types";
import { AbstractPollingTransport } from "@shared/transport/AbstractPollingTransport";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { fetchWithTimeout } from "@shared/fetchWithTimeout";

export class PollingTransport extends AbstractPollingTransport implements Transport {
  private logger: ConfigDirectorLogger;
  private eventEmitter = new EventEmitter();
  private url: URL;
  private lastUpdateTimestamp: string | undefined;
  private readonly _sessionId = randomUUID();

  constructor(private readonly options: TransportOptions) {
    super();
    this.options = options;
    this.logger = options.logger;
    this.url = new URL("server/polling/v1", options.baseUrl);
    this.pollingIntervalSeconds = options.pollingInterval ?? 60;
  }

  public async connect(timeout: number): Promise<this> {
    this.clearPollingInterval();

    try {
      await this.fetchConfigs(timeout);
    } finally {
      // A transient failure on the first fetch must not leave the SDK without a
      // connection, so polling is scheduled either way. An unrecoverable failure has
      // already closed the transport and must not be retried.
      if (!this.fatalError) {
        this.schedulePollingInterval(() => {
          void this.fetchConfigs(timeout).catch((error) => {
            this.logger.error("[PollingTransport] Error during polling:", error);
          });
        });
      }
    }

    return this;
  }

  public get sessionId(): string {
    return this._sessionId;
  }

  private async fetchConfigs(timeout: number) {
    if (this.fatalError) {
      this.logger.warn(
        "[PollingTransport] There was a prior unrecoverable error. Ignoring attempt to reconnect.",
      );
      return;
    }

    try {
      const response = await fetchWithTimeout(
        timeout,
        this.url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metaContext: this.options.metaContext,
            serverSdkKey: this.options.serverSdkKey,
            lastUpdateTimestamp: this.lastUpdateTimestamp,
            sessionId: this._sessionId,
          }),
        },
        this.logger,
      );

      await this.handleNonOkResponse(response);

      if (response.status === 200) {
        const json = JSON.parse(await response.text());
        this.lastUpdateTimestamp = json.timestamp;
        this.eventEmitter.emit("configBundleReceived", json);
      }
    } catch (fetchError) {
      try {
        this.handleFetchError(fetchError);
      } catch (handledError) {
        if (this.fatalError) {
          this.eventEmitter.emit("connectionError", handledError);
        }
        throw handledError;
      }
    }
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
}
