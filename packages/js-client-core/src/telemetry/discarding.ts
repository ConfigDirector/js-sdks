import type { TelemetryClient } from "./types";

export const discardingTelemetryClient: TelemetryClient = {
  updateContext: async () => {},
  evaluatedConfig: () => {},
  recordInvalidContext: () => {},
  trackedEvent: () => {},
  close: async () => {},
};
