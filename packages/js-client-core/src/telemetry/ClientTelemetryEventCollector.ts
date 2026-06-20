import { type TelemetryValue } from "@shared/telemetry/utils";
import { type ConfigDirectorContext } from "../types";
import { ClientEventReporter } from "./ClientEventReporter";
import type { EvaluatedConfigEvent } from "@shared/telemetry/telemetry-events";
import type { EventSnapshotPreprocessor, ReporterResponse} from "./types";
import { type EventReporter } from "./types";
import {
  TelemetryEventCollector,
  type TelemetryEventCollectorOptions,
} from "@shared/telemetry/TelemetryEventCollector";
import { EvaluatedConfigEventPreprocessor } from "@shared/telemetry/EvaluatedConfigEventPreprocessor";

export class ClientTelemetryEventCollector extends TelemetryEventCollector<
  EvaluatedConfigEvent<TelemetryValue>
> {
  protected override evaluationEventSnapshotPreprocessor: EventSnapshotPreprocessor<
    EvaluatedConfigEvent<TelemetryValue>
  >;
  protected readonly reporter: EventReporter;
  protected _context?: ConfigDirectorContext;

  constructor(options: TelemetryEventCollectorOptions) {
    super(options);
    this.reporter = new ClientEventReporter(options);
    this.evaluationEventSnapshotPreprocessor = new EvaluatedConfigEventPreprocessor(options.valueIdGenerator);
  }

  public async updateContext(value: ConfigDirectorContext | undefined) {
    this.cancelScheduledFlush();
    await this.flush();
    this._context = value;
    await this.flushAndScheduleNext();
  }

  public evaluatedConfig(event: EvaluatedConfigEvent<TelemetryValue>): void {
    if (!this.collectEvents) {
      return;
    }

    this.evaluationEventQueue.push(event);
  }

  public async forceFlush() {
    this.cancelScheduledFlush();
    await this.flushAndScheduleNext();
  }

  protected override async flush(): Promise<ReporterResponse> {
    if (!this.reporter) {
      return { success: false, fatalError: false };
    }
    const evaluationSnapshot = await this.evaluationEventSnapshotPreprocessor.process(
      this.evaluationEventQueue.takeSnapshot(),
    );
    const response = await this.reporter?.report({
      context: this._context,
      discreteEvents: {},
      aggregatedEvents: {
        evaluatedConfig: this.aggregator.aggregate(evaluationSnapshot),
      },
      droppedEvents: {
        evaluatedConfig: evaluationSnapshot.droppedCount,
      },
    });
    return response;
  }
}
