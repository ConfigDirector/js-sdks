import type { ConfigDirectorContext, ConfigValueType } from "../types";
import { ServerEventReporter } from "./ServerEventReporter";
import type { EvaluatedConfigEvent } from "./telemetry-events";
import type {
  EvaluatedConfig,
  EventReporter,
  ReporterResponse,
  ServerTelemetryEventCollectorOptions,
} from "./types";
import { TelemetryEventCollector } from "@shared/telemetry/TelemetryEventCollector";
import { LimitedMap } from "@shared/LimitedMap";
import type { TelemetryValue } from "@shared/telemetry/utils";

const DEFAULT_CONTEXTS_LIMIT = 1_000;

export class ServerTelemetryEventCollector extends TelemetryEventCollector<
  EvaluatedConfigEvent<TelemetryValue>
> {
  protected readonly reporter: EventReporter;
  protected _context?: ConfigDirectorContext;
  private readonly contexts: LimitedMap<string, ConfigDirectorContext>;

  constructor(options: ServerTelemetryEventCollectorOptions) {
    super(options);
    this.reporter = new ServerEventReporter(options);
    this.contexts = new LimitedMap(options.contextLimit ?? DEFAULT_CONTEXTS_LIMIT);
  }

  public evaluatedConfig<T extends ConfigValueType>(payload: EvaluatedConfig<T>): void {
    if (!this.collectEvents) {
      return;
    }
    if (payload.context?.id && !payload.context.anonymous) {
      this.contexts.set(payload.context.id, payload.context);
    }
    const event = {
      ...payload.evaluation,
      contextId: payload.context?.anonymous ? undefined : payload.context?.id,
    };

    this.evaluationEventQueue.push(this.sanitizeEvaluatedConfigEvent(event));
  }

  private sanitizeEvaluatedConfigEvent<T extends ConfigValueType>(
    event: EvaluatedConfigEvent<T>,
  ): EvaluatedConfigEvent<TelemetryValue> {
    return {
      ...event,
      defaultValue: this.sanitizeValue(event.defaultValue, event.type),
      evaluatedValue: this.sanitizeValue(event.evaluatedValue, event.type),
    };
  }

  private snapshotContexts() {
    const contexts = Array.from(this.contexts.values());
    const droppedCount = this.contexts.droppedCount;
    this.contexts.clearAndReset();
    return { contexts, droppedCount };
  }

  protected override async flush(): Promise<ReporterResponse> {
    if (!this.reporter) {
      return { success: false, fatalError: false };
    }
    const evaluationSnapshot = this.evaluationEventQueue.takeSnapshot();
    const contextsSnapshot = this.snapshotContexts();
    const response = await this.reporter?.report({
      context: this._context,
      discreteEvents: {
        capturedContexts: contextsSnapshot.contexts,
      },
      aggregatedEvents: {
        evaluatedConfig: this.aggregator.aggregate(evaluationSnapshot),
      },
      droppedEvents: {
        evaluatedConfig: evaluationSnapshot.droppedCount,
        capturedContexts: contextsSnapshot.droppedCount,
      },
    });
    return response;
  }
}
