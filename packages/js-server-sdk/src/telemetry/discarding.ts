import type { ServerTelemetryClient } from "./types";

export const discardingTelemetryClient: ServerTelemetryClient = {
  start: () => {},
  evaluatedConfig: () => {},
  recordInvalidContext: () => "new-kind-sample",
  close: async () => {},
};
