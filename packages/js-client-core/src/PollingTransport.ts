import type {
  ConfigDirectorContext,
  ConfigDirectorLogger,
  Transport,
  TransportEvents,
  TransportOptions,
} from "./types";
import { Emitter } from "./Emitter";
import { AbstractPollingTransport } from "@shared/transport/AbstractPollingTransport";
import { fetchWithTimeout } from "@shared/fetchWithTimeout";
import type { UrlLike } from "@shared/url";

export class PollingTransport extends AbstractPollingTransport implements Transport {
  private logger: ConfigDirectorLogger;
  private eventEmitter = new Emitter<TransportEvents>();
  private url: UrlLike;
  private lastUpdateTimestamp: string | undefined;

  constructor(private readonly options: TransportOptions) {
    super();
    this.options = options;
    this.logger = options.logger;
    this.url = options.resolveUrl("client/polling/v1", options.baseUrl);
    this.pollingIntervalSeconds = options.pollingInterval ?? 60;
  }

  public async connect(context: ConfigDirectorContext, timeout: number): Promise<this> {
    this.clearPollingInterval();

    try {
      await this.fetchConfigs(context, timeout);
    } finally {
      // A transient failure on the first fetch must not leave the client without a
      // connection, so polling is scheduled either way. An unrecoverable failure has
      // already closed the transport and must not be retried.
      if (!this.fatalError) {
        this.schedulePollingInterval(() => {
          void this.fetchConfigs(context, timeout).catch((error) => {
            this.logger.error("[PollingTransport] Error during polling:", error);
          });
        });
      }
    }

    return this;
  }

  private async fetchConfigs(context: ConfigDirectorContext, timeout: number) {
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
            givenContext: context,
            metaContext: this.options.metaContext,
            clientSdkKey: this.options.clientSdkKey,
            instanceId: this.options.instanceId,
            lastUpdateTimestamp: this.lastUpdateTimestamp,
          }),
        },
        this.logger,
      );

      await this.handleNonOkResponse(response);

      if (response.status == 200) {
        const json = JSON.parse(await response.text());
        this.lastUpdateTimestamp = json.timestamp;
        this.eventEmitter.emit("configSetReceived", json);
      }
    } catch (fetchError) {
      this.handleFetchError(fetchError);
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
    this.eventEmitter.off(name, handler);
  }

  public clear(): void {
    this.eventEmitter.clear();
  }
}
