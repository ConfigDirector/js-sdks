import type { ServerTelemetryClient } from "./types";

export const discardingTelemetryClient: ServerTelemetryClient = {
  start: () => {},
  evaluatedConfig: () => {},
  recordInvalidContextKind: () => "new-kind-sample",
  trackedEvent: () => {},
  close: async () => {},
};
