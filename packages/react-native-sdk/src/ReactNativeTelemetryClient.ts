import {
  ClientTelemetryEventCollector,
  type EvaluatedConfigEvent,
  type TelemetryClient,
} from "@js-client-core/telemetry";
import { sanitizeValue } from "@shared/telemetry/utils";
import type {
  ConfigDirectorContext,
  ConfigDirectorLogger,
  ConfigValueType,
} from "@shared/types";
import type { UrlFactory, UrlLike } from "@shared/url";

export class ReactNativeTelemetryClient implements TelemetryClient {
  private readonly collector: ClientTelemetryEventCollector;

  constructor(
    sdkKey: string,
    baseUrl: UrlLike,
    logger: ConfigDirectorLogger,
    urlFactory: UrlFactory,
  ) {
    this.collector = new ClientTelemetryEventCollector({
      sdkKey,
      logger,
      baseUrl,
      urlFactory,
    });
  }

  public async updateContext(
    value: ConfigDirectorContext | undefined,
  ): Promise<void> {
    return await this.collector.updateContext(value);
  }

  public evaluatedConfig<T extends ConfigValueType>(
    event: EvaluatedConfigEvent<T>,
  ): void {
    this.collector.evaluatedConfig(this.sanitizeEvaluatedConfigEvent(event));
  }

  public async close(): Promise<void> {
    await this.collector.close();
  }

  private sanitizeEvaluatedConfigEvent<T extends ConfigValueType>(
    event: EvaluatedConfigEvent<T>,
  ): EvaluatedConfigEvent<string> {
    return {
      ...event,
      defaultValue: sanitizeValue(event.defaultValue, event.type),
      evaluatedValue: sanitizeValue(event.evaluatedValue, event.type),
    };
  }
}
