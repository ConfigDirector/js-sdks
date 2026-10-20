import type { ConfigDirectorContext, ConfigDirectorLogger, ConfigDirectorMetaContext, ConfigValueType } from "../types";
import type { UrlLike } from "@shared/url";
import type { DiscreteEventList, AggregatedEventList, DroppedEvents } from "@shared/telemetry/types";
import type { EvaluatedConfigEvent } from "@shared/telemetry/telemetry-events";
export * from "@shared/telemetry/types";

export type EventReport = {
  clientSdkKey: string;
  context?: ConfigDirectorContext | undefined;
  metaContext: {
    sdkName: string;
    sdkVersion: string;
    appName?: string;
    appVersion?: string;
  },
  discreteEvents: DiscreteEventList;
  aggregatedEvents: AggregatedEventList;
  droppedEvents?: DroppedEvents;
};

/**
 * What a live connection gives the platform to build its telemetry client with.
 */
export type LiveTelemetryClientOptions = {
  clientSdkKey: string;
  baseUrl: UrlLike;
  logger: ConfigDirectorLogger;
  metadata: ConfigDirectorMetaContext | undefined;
};

/**
 * Builds the telemetry client of a client that connects to ConfigDirector. An offline client never
 * calls it: it takes the discarding telemetry client instead.
 */
export type LiveTelemetryClientFactory = (options: LiveTelemetryClientOptions) => TelemetryClient;

export interface TelemetryClient {
  updateContext(value: ConfigDirectorContext | undefined): Promise<void>;

  evaluatedConfig<T extends ConfigValueType>(event: EvaluatedConfigEvent<T>): void;

  recordInvalidContext(kindSample: string): void;

  close(): Promise<void>;
}
