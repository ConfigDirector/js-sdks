import type { ContextSizeLimitReason, InvalidContextEvent } from "./telemetry-events";
import type { AggregatedEvent } from "./types";

export const DISTINCT_KIND_SAMPLE_LIMIT = 20;

export type InvalidKindRecording =
  | "new-kind-sample"
  | "known-kind-sample"
  | "first-beyond-sample-limit"
  | "beyond-sample-limit";

export class InvalidContextSubmissions {
  private readonly countsByKindSample = new Map<string, number>();
  private countBeyondSampleLimit = 0;
  private readonly countsBySizeLimit = new Map<ContextSizeLimitReason, number>();
  private startTime: Date | undefined;

  public recordInvalidKind(kindSample: string): InvalidKindRecording {
    this.startTime ??= new Date();
    return this.addInvalidKind(kindSample, 1);
  }

  public recordOverSizeLimit(reason: ContextSizeLimitReason): void {
    this.startTime ??= new Date();
    this.addOverSizeLimit(reason, 1);
  }

  public absorb(entries: AggregatedEvent<InvalidContextEvent>[]): void {
    for (const entry of entries) {
      if (this.startTime === undefined || entry.startTime < this.startTime) {
        this.startTime = entry.startTime;
      }
      const { event } = entry;
      if (event.reason === "invalid-context-kind") {
        this.addInvalidKind(event.kindSample, entry.count);
      } else {
        this.addOverSizeLimit(event.reason, entry.count);
      }
    }
  }

  private addInvalidKind(kindSample: string | undefined, count: number): InvalidKindRecording {
    if (kindSample !== undefined) {
      const knownCount = this.countsByKindSample.get(kindSample);
      if (knownCount !== undefined) {
        this.countsByKindSample.set(kindSample, knownCount + count);
        return "known-kind-sample";
      }
      if (this.countsByKindSample.size < DISTINCT_KIND_SAMPLE_LIMIT) {
        this.countsByKindSample.set(kindSample, count);
        return "new-kind-sample";
      }
    }
    const firstBeyondSampleLimit = this.countBeyondSampleLimit === 0;
    this.countBeyondSampleLimit += count;
    return firstBeyondSampleLimit ? "first-beyond-sample-limit" : "beyond-sample-limit";
  }

  private addOverSizeLimit(reason: ContextSizeLimitReason, count: number) {
    this.countsBySizeLimit.set(reason, (this.countsBySizeLimit.get(reason) ?? 0) + count);
  }

  public takeSnapshot(): AggregatedEvent<InvalidContextEvent>[] {
    const endTime = new Date();
    const startTime = this.startTime ?? endTime;
    const entryOf = (count: number, event: InvalidContextEvent): AggregatedEvent<InvalidContextEvent> => ({
      startTime,
      endTime,
      count,
      event,
    });
    const sampledEntries = Array.from(this.countsByKindSample, ([kindSample, count]) =>
      entryOf(count, { reason: "invalid-context-kind", kindSample }),
    );
    const invalidKindEntries =
      this.countBeyondSampleLimit > 0
        ? [...sampledEntries, entryOf(this.countBeyondSampleLimit, { reason: "invalid-context-kind" })]
        : sampledEntries;
    const sizeLimitEntries = Array.from(this.countsBySizeLimit, ([reason, count]) =>
      entryOf(count, { reason }),
    );
    this.clear();
    return [...invalidKindEntries, ...sizeLimitEntries];
  }

  private clear() {
    this.countsByKindSample.clear();
    this.countBeyondSampleLimit = 0;
    this.countsBySizeLimit.clear();
    this.startTime = undefined;
  }
}
