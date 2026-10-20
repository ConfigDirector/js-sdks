import type { TelemetryClient } from "./types";

export const discardingTelemetryClient: TelemetryClient = {
  updateContext: async () => {},
  evaluatedConfig: () => {},
  recordInvalidContext: () => {},
  close: async () => {},
};
