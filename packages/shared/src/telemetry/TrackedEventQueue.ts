import { TRACKED_EVENTS_PER_BATCH } from "./tracked-events";
import type { TrackedEventAdmission, TrackedEventEntry, TrackedEventWarning } from "./tracked-events";

export class TrackedEventQueue {
  private entries: TrackedEventEntry[] = [];
  private readonly warningsRaisedThisBatch = new Set<TrackedEventWarning>();

  public add(admission: TrackedEventAdmission): TrackedEventWarning[] {
    return this.warningsOfKeeping(admission).filter((warning) => this.isFirstThisBatch(warning));
  }

  public absorb(entries: TrackedEventEntry[]): void {
    this.entries.push(...entries);
  }

  public takeBatch(): TrackedEventEntry[] {
    const batch = this.entries;
    this.clear();
    return batch;
  }

  public clear(): void {
    this.entries = [];
    this.warningsRaisedThisBatch.clear();
  }

  private warningsOfKeeping(admission: TrackedEventAdmission): TrackedEventWarning[] {
    switch (admission.outcome) {
      case "dropped":
        return admission.warnings;
      case "admitted":
        if (this.entries.length >= TRACKED_EVENTS_PER_BATCH) {
          return ["batch-already-full"];
        }
        this.entries.push(admission.entry);
        return admission.warnings;
    }
  }

  private isFirstThisBatch(warning: TrackedEventWarning): boolean {
    if (this.warningsRaisedThisBatch.has(warning)) {
      return false;
    }
    this.warningsRaisedThisBatch.add(warning);
    return true;
  }
}
