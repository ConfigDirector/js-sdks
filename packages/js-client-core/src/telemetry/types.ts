import type { ConfigDirectorContext, ConfigValueType } from "../types";
import type { DiscreteEventList, AggregatedEventList, DroppedEvents } from "@shared/telemetry/types";
import type { EvaluatedConfigEvent } from "@shared/telemetry/telemetry-events";
export * from "@shared/telemetry/types";

export type EventReport = {
  clientSdkKey: string;
  context?: ConfigDirectorContext | undefined;
  metaContext: {
    sdkName: string;
    sdkVersion: string;
  },
  discreteEvents: DiscreteEventList;
  aggregatedEvents: AggregatedEventList;
  droppedEvents?: DroppedEvents;
};

export interface TelemetryClient {
  updateContext(value: ConfigDirectorContext | undefined): Promise<void>;

  evaluatedConfig<T extends ConfigValueType>(event: EvaluatedConfigEvent<T>): void;

  close(): Promise<void>;
}
