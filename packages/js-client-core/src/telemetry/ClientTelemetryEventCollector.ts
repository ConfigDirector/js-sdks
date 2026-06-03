import type { TelemetryValue } from "@shared/telemetry/utils";
import { type ConfigDirectorContext } from "../types";
import { ClientEventReporter } from "./ClientEventReporter";
import { type EvaluatedConfigEvent } from "./telemetry-events";
import { type EventReporter } from "./types";
import { TelemetryEventCollector, type TelemetryEventCollectorOptions } from "@shared/telemetry/TelemetryEventCollector";

export class ClientTelemetryEventCollector extends TelemetryEventCollector<EvaluatedConfigEvent<TelemetryValue>> {
  protected readonly reporter: EventReporter;
  protected _context?: ConfigDirectorContext;

  constructor(options: TelemetryEventCollectorOptions) {
    super(options);
    this.reporter = new ClientEventReporter(options);
  }

  public async updateContext(value: ConfigDirectorContext | undefined) {
    this.cancelScheduledFlush();
    await this.flush();
    this._context = value;
    await this.flushAndScheduleNext();
  };

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
}
