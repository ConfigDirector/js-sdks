import type { DiscreteEventList, AggregatedEventList, DroppedEvents } from "@shared/telemetry/types";
import type { ConfigDirectorContext, ConfigType, ConfigValueType, EvaluationReason } from "../types";
import type { TelemetryEventCollectorOptions } from "@shared/telemetry/TelemetryEventCollector";
export * from "@shared/telemetry/types";

export type ServerTelemetryEventCollectorOptions = TelemetryEventCollectorOptions & {
  contextLimit?: number;
};

export type EventReport = {
  serverSdkKey: string;
  metaContext: {
    sdkName: string;
    sdkVersion: string;
  },
  discreteEvents: DiscreteEventList;
  aggregatedEvents: AggregatedEventList;
  droppedEvents?: DroppedEvents;
};

export type EvaluatedConfig<T extends ConfigValueType> = {
  context?: ConfigDirectorContext | undefined | null;
  evaluation: {
    key: string;
    type?: ConfigType;
    defaultValue: T;
    requestedType: string;
    evaluatedValue: T;
    evaluatedValueId?: string | null | undefined;
    usedDefault: boolean;
    evaluationReason: EvaluationReason;
  };
};
