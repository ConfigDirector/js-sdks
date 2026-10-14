import type { InvalidContextEvent } from "./telemetry-events";
import type { AggregatedEvent } from "./types";

export const DISTINCT_KIND_SAMPLE_LIMIT = 20;

export type InvalidContextRecording =
  | "new-kind-sample"
  | "known-kind-sample"
  | "first-beyond-sample-limit"
  | "beyond-sample-limit";

export class InvalidContextSubmissions {
  private readonly countsByKindSample = new Map<string, number>();
  private countBeyondSampleLimit = 0;
  private startTime: Date | undefined;

  public record(kindSample: string): InvalidContextRecording {
    this.startTime ??= new Date();
    const count = this.countsByKindSample.get(kindSample);
    if (count !== undefined) {
      this.countsByKindSample.set(kindSample, count + 1);
      return "known-kind-sample";
    }
    if (this.countsByKindSample.size < DISTINCT_KIND_SAMPLE_LIMIT) {
      this.countsByKindSample.set(kindSample, 1);
      return "new-kind-sample";
    }
    this.countBeyondSampleLimit += 1;
    return this.countBeyondSampleLimit === 1 ? "first-beyond-sample-limit" : "beyond-sample-limit";
  }

  public takeSnapshot(): AggregatedEvent<InvalidContextEvent>[] {
    const endTime = new Date();
    const startTime = this.startTime ?? endTime;
    const entryOf = (count: number, kindSample?: string): AggregatedEvent<InvalidContextEvent> => ({
      startTime,
      endTime,
      count,
      event: { reason: "invalid-context-kind", kindSample },
    });
    const sampledEntries = Array.from(this.countsByKindSample, ([kindSample, count]) =>
      entryOf(count, kindSample),
    );
    const entries =
      this.countBeyondSampleLimit > 0
        ? [...sampledEntries, entryOf(this.countBeyondSampleLimit)]
        : sampledEntries;
    this.clear();
    return entries;
  }

  private clear() {
    this.countsByKindSample.clear();
    this.countBeyondSampleLimit = 0;
    this.startTime = undefined;
  }
}
