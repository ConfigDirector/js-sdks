import type { ConfigDirectorContext, ConfigDirectorLogger, IdentifyingSdkOptions } from "../types";
import { EventAggregator } from "./EventAggregator";
import { EventQueue } from "./EventQueue";
import type { EventReporter, EventSnapshotPreprocessor, ReportableEvent, ReporterResponse, ValueIdGenerator } from "./types";
import type { UrlFactory, UrlLike } from "../url";

export type TelemetryEventCollectorOptions = {
  sdkKey: string;
  sdkIdentity: IdentifyingSdkOptions;
  logger: ConfigDirectorLogger;
  baseUrl: UrlLike;
  urlFactory: UrlFactory;
  valueIdGenerator: ValueIdGenerator;
  flushIntervalDelay?: number;
  initialFlushIntervalDelay?: number;
  evaluationQueueLimit?: number;
};

export abstract class TelemetryEventCollector<T extends ReportableEvent> {
  protected readonly logger: ConfigDirectorLogger;
  protected abstract readonly reporter: EventReporter | undefined;
  protected readonly evaluationEventQueue: EventQueue<T>;
  protected readonly aggregator: EventAggregator = new EventAggregator();
  protected flushIntervalDelay: number;
  protected flushTimeout: ReturnType<typeof setTimeout>;
  protected collectEvents = true;
  protected abstract _context?: ConfigDirectorContext;
  protected abstract evaluationEventSnapshotPreprocessor: EventSnapshotPreprocessor<T>;

  constructor(options: TelemetryEventCollectorOptions) {
    this.logger = options.logger;
    this.evaluationEventQueue = new EventQueue(options.evaluationQueueLimit ?? 1_000);
    this.flushIntervalDelay = options.flushIntervalDelay ?? 30_000;
    const initialDelay = options.initialFlushIntervalDelay ?? 5_000;
    this.flushTimeout = setTimeout(() => this.flushAndScheduleNext(), initialDelay);
  }

  protected abstract flush(): Promise<ReporterResponse>;

  protected async flushAndScheduleNext() {
    const response = await this.flush();
    if (response.fatalError) {
      this.collectEvents = false;
      this.close();
      this.logger.warn(
        "[TelemetryEventCollector] Received a fatal error from telemetry collection. No longer collecting events.",
      );
    } else {
      this.flushTimeout = setTimeout(() => this.flushAndScheduleNext(), this.flushIntervalDelay);
    }
  }

  protected cancelScheduledFlush() {
    clearTimeout(this.flushTimeout);
  }

  public async close() {
    this.collectEvents = false;
    clearTimeout(this.flushTimeout);
    await this.flush();
    this.evaluationEventQueue.clear();
  }

  public dispose() {
    this.close();
  }
}
