import { type ConfigDirectorContext } from "../types";

export type ReportableEvent = Record<string | symbol, any>;

export type EventQueueSnapshot<T extends ReportableEvent> = {
  startTime: Date;
  endTime: Date;
  events: T[];
  droppedCount: number;
};

export type AggregatedEvent<T extends ReportableEvent> = {
  startTime: Date;
  endTime: Date;
  count: number;
  event: T;
};

export type DiscreteEventList = Record<string | symbol, ReportableEvent[]>;
export type AggregatedEventList = Record<string | symbol, AggregatedEvent<ReportableEvent>[]>;
export type DroppedEvents = Record<string, number>;

export type ReporterResponse = {
  success: boolean;
  fatalError: boolean;
};

export type EventReporterPayload = {
  discreteEvents: DiscreteEventList;
  aggregatedEvents: AggregatedEventList;
  droppedEvents?: DroppedEvents;
  context?: ConfigDirectorContext | undefined;
};

export interface EventReporter {
  report(payload: EventReporterPayload): Promise<ReporterResponse>;
}

export interface EventSnapshotPreprocessor<T extends ReportableEvent> {
  process(snapshot: EventQueueSnapshot<T>): Promise<EventQueueSnapshot<T>>;
}

export type ValueIdGenerator = (v: string | number | boolean | null | undefined) => Promise<string>;
