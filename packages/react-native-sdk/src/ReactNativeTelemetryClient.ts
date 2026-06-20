import {
  ClientTelemetryEventCollector,
  type EvaluatedConfigEvent,
  type TelemetryClient,
} from "@js-client-core/telemetry";
import { mapToTelemetryValue, type TelemetryValue } from "@shared/telemetry/utils";
import type { ConfigDirectorContext, ConfigDirectorLogger, ConfigValueType } from "@shared/types";
import type { UrlFactory, UrlLike } from "@shared/url";
import { generateValueId } from "./value-id-generator";

export class ReactNativeTelemetryClient implements TelemetryClient {
  private readonly collector: ClientTelemetryEventCollector;

  constructor(sdkKey: string, baseUrl: UrlLike, logger: ConfigDirectorLogger, urlFactory: UrlFactory) {
    this.collector = new ClientTelemetryEventCollector({
      sdkKey,
      logger,
      baseUrl,
      urlFactory,
      valueIdGenerator: async (v: string | boolean | number | null | undefined) => generateValueId(v),
    });
  }

  public async updateContext(value: ConfigDirectorContext | undefined): Promise<void> {
    return await this.collector.updateContext(value);
  }

  public evaluatedConfig<T extends ConfigValueType>(event: EvaluatedConfigEvent<T>): void {
    this.collector.evaluatedConfig(this.sanitizeEvaluatedConfigEvent(event));
  }

  public async close(): Promise<void> {
    await this.collector.close();
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
}
