import type { ConfigDirectorContext, ConfigDirectorLogger, TrackedEvent } from "../types";
import { trackedEventWarningMessages } from "./tracked-events";
import type { TrackedEventAdmission, TrackedEventEntry } from "./tracked-events";

const recordedEventOf = (entry: TrackedEventEntry, context: ConfigDirectorContext | undefined): TrackedEvent => ({
  name: entry.name,
  ...(context === undefined ? {} : { context }),
  ...(entry.value === undefined ? {} : { value: entry.value }),
  ...(entry.details === undefined ? {} : { details: entry.details }),
});

export class RecordedTrackedEvents {
  public readonly events: TrackedEvent[] = [];

  constructor(private readonly logger: ConfigDirectorLogger) {}

  public record(admission: TrackedEventAdmission, context: ConfigDirectorContext | undefined): void {
    admission.warnings.forEach((warning) => this.logger.warn(trackedEventWarningMessages[warning]));
    switch (admission.outcome) {
      case "dropped":
        return;
      case "admitted":
        this.events.push(recordedEventOf(admission.entry, context));
        return;
    }
  }
}
