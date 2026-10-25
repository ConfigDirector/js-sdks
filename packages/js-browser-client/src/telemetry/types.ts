import type {
  ClientSession,
  ConfigDirectorContext,
  ConfigDirectorLoggingLevel,
  ConfigDirectorMetaContext,
  IdentifyingSdkOptions,
} from "@js-client-core/types";
import type { EvaluatedConfigEvent } from "@js-client-core/telemetry";
import type { InvalidContextEvent } from "@shared/telemetry/telemetry-events";
import type { AggregatedEvent } from "@shared/telemetry/types";
import type { TelemetryValue } from "@shared/telemetry/utils";
export * from "@shared/telemetry/types";

export type TelemetryFlushEvent = {
  type: "Flush";
};

export type TelemetryCloseEvent = {
  type: "Close";
};

export type TelemetryUpdateContextEvent = {
  type: "UpdateContext";
  payload: {
    context: ConfigDirectorContext | undefined;
  };
};

export type TelemetryInitializeEvent = {
  type: "Initialize";
  payload: {
    sdkKey: string;
    sdkIdentity: IdentifyingSdkOptions;
    metaContext: ConfigDirectorMetaContext;
    baseUrl: string;
    evaluationQueueLimit: number;
    initialFlushIntervalDelay: number;
    flushIntervalDelay: number;
  };
};

export type TelemetryClientSessionEvent = {
  type: "ClientSession";
  payload: ClientSession;
};

export type TelemetryEvaluatedConfigEvent = {
  type: "EvaluatedConfigEvent";
  payload: EvaluatedConfigEvent<TelemetryValue>;
};

export type TelemetryInvalidContextSubmissionsEvent = {
  type: "InvalidContextSubmissions";
  payload: {
    entries: AggregatedEvent<InvalidContextEvent>[];
  };
};

export type TelemetryWorkerEvent =
  | TelemetryFlushEvent
  | TelemetryCloseEvent
  | TelemetryInitializeEvent
  | TelemetryClientSessionEvent
  | TelemetryEvaluatedConfigEvent
  | TelemetryInvalidContextSubmissionsEvent
  | TelemetryUpdateContextEvent;

export type TelemetryWorkerLoggingEvent = {
  type: "Log";
  payload: {
    level: ConfigDirectorLoggingLevel;
    message: string;
    args: any[];
  };
};

export type TelemetryWorkerClosedEvent = {
  type: "Closed";
};

export type TelemetryWorkerResponseEvent = TelemetryWorkerLoggingEvent | TelemetryWorkerClosedEvent;
