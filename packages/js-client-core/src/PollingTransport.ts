import type {
  ConfigDirectorContext,
  ConfigDirectorLogger,
  Transport,
  TransportEvents,
  TransportOptions,
} from "./types";
import { Emitter } from "./Emitter";
import { ConfigDirectorConnectionError, isFetchErrorFatal } from "./errors";
import { fetchWithTimeout } from "@shared/fetchWithTimeout";
import type { UrlLike } from "@shared/url";

export class PollingTransport implements Transport {
  private logger: ConfigDirectorLogger;
  private eventEmitter = new Emitter<TransportEvents>();
  private url: UrlLike;
  private fatalError = false;
  private lastUpdateTimestamp: string | undefined;
  private pollingIntervalSeconds: number;
  private pollingInterval: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly options: TransportOptions) {
    this.options = options;
    this.logger = options.logger;
    this.url = options.resolveUrl("client/polling/v1", options.baseUrl);
    this.pollingIntervalSeconds = options.pollingInterval ?? 60;
  }

  public async connect(context: ConfigDirectorContext, timeout: number): Promise<this> {
    clearInterval(this.pollingInterval);

    await this.fetchConfigs(context, timeout);

    this.pollingInterval = setInterval(() => {
      void this.fetchConfigs(context, timeout);
    }, this.pollingIntervalSeconds * 1_000);

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
            lastUpdateTimestamp: this.lastUpdateTimestamp,
          }),
        },
        this.logger,
      );

      if (!response.ok) {
        if (this.isStatusFatal(response.status)) {
          this.fatalError = true;
          throw this.prepareFatalResponseStatusError(response.status, await response.text());
        } else {
          throw new ConfigDirectorConnectionError(
            `Connection failed with status: ${response.status}`,
            response.status,
          );
        }
      }

      if (response.status == 200) {
        const json = JSON.parse(await response.text());
        this.lastUpdateTimestamp = json.timestamp;
        this.eventEmitter.emit("configSetReceived", json);
      }
    } catch (fetchError) {
      if (isFetchErrorFatal(fetchError)) {
        this.fatalError = true;
        this.close();
        throw new ConfigDirectorConnectionError(
          `Connection failed with fatal error: ${fetchError}. This is an unrecoverable error, retry attempts will be ignored.`,
        );
      } else if (fetchError instanceof SyntaxError) {
        throw new ConfigDirectorConnectionError(
          `Failed to parse the response from the server: ${fetchError}`,
        );
      } else {
        throw new ConfigDirectorConnectionError(`Connection failed with error: ${fetchError}.`);
      }
    }
  }

  private prepareFatalResponseStatusError(
    responseStatus: number,
    errorBody: string | undefined,
  ): ConfigDirectorConnectionError {
    const status = responseStatus ?? 0;
    const headline = `Connection failed with status: ${responseStatus ?? "unknown"}`;
    const serverBody = (errorBody?.trim()?.length ?? 0) > 0 ? ` (${errorBody})` : "";
    const message = `${headline}${serverBody}. This is an unrecoverable error, retry attempts will be ignored.`;
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
    clearInterval(this.pollingInterval);
  }

  public dispose(): void {
    this.close();
    this.clear();
  }
}
