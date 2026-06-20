import type { EvaluatedConfigEvent } from "./telemetry-events";
import type { EventQueueSnapshot, EventSnapshotPreprocessor, ValueIdGenerator } from "./types";
import type { TelemetryValue } from "./utils";
import { compactTelemetryValue } from "./utils";

export class EvaluatedConfigEventPreprocessor implements EventSnapshotPreprocessor<
  EvaluatedConfigEvent<TelemetryValue>
> {
  constructor(private readonly valueIdGenerator: ValueIdGenerator) {
    this.valueIdGenerator = valueIdGenerator;
  }

  async process(
    snapshot: EventQueueSnapshot<EvaluatedConfigEvent<TelemetryValue>>,
  ): Promise<EventQueueSnapshot<EvaluatedConfigEvent<TelemetryValue>>> {
    const events = await Promise.all(
      snapshot.events.map(async (e) => {
        return {
          ...e,
          defaultValue: await compactTelemetryValue(e.defaultValue, this.valueIdGenerator),
          evaluatedValue: await compactTelemetryValue(e.evaluatedValue, this.valueIdGenerator),
        };
      }),
    );

    return { ...snapshot, events };
  }
}
