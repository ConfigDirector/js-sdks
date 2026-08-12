import {
  ClientTelemetryEventCollector,
  type EvaluatedConfigEvent,
  type TelemetryClient,
} from "@js-client-core/telemetry";
import { mapToTelemetryValue, type TelemetryValue } from "@shared/telemetry/utils";
import type {
  ConfigDirectorContext,
  ConfigDirectorLogger,
  ConfigValueType,
  IdentifyingSdkOptions,
} from "@shared/types";
import type { UrlFactory, UrlLike } from "@shared/url";
import { generateValueId } from "./value-id-generator";

type ReactNativeTelemetryClientOptions = {
  sdkKey: string;
  sdkIdentity: IdentifyingSdkOptions;
  baseUrl: UrlLike;
  logger: ConfigDirectorLogger;
  urlFactory: UrlFactory;
};

export class ReactNativeTelemetryClient implements TelemetryClient {
  private readonly collector: ClientTelemetryEventCollector;

  constructor(options: ReactNativeTelemetryClientOptions) {
    this.collector = new ClientTelemetryEventCollector({
      ...options,
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
