import type { TelemetryClient } from "./types";

export const discardingTelemetryClient: TelemetryClient = {
  updateContext: async () => {},
  evaluatedConfig: () => {},
  recordInvalidContextKind: () => {},
  recordContextOverSizeLimit: () => {},
  trackedEvent: () => {},
  close: async () => {},
};
