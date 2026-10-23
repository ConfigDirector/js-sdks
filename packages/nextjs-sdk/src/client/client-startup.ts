import type { ConfigDirectorClient, ConfigDirectorContext } from "@js-browser-client/index";
import { decideMountAction } from "@js-client-core/mountAction";
import type { MountAction } from "@js-client-core/mountAction";
import { deepEqual } from "@shared/deepEqual";

type StartupAction = MountAction | "waitForContext";

export const decideStartupAction = (
  client: ConfigDirectorClient,
  context: ConfigDirectorContext | undefined,
  waitsForFirstContext: boolean,
): StartupAction => {
  const mountAction = decideMountAction(client, context);
  if (waitsForFirstContext && mountAction === "initialize" && context === undefined) {
    return "waitForContext";
  }
  return mountAction;
};

export type StartupPhase =
  | { kind: "beforeFirstRenderEffects" }
  | { kind: "waitingForContext"; client: ConfigDirectorClient }
  | { kind: "started"; client: ConfigDirectorClient };

const startupPhaseKindAfter: { [A in StartupAction]: "waitingForContext" | "started" } = {
  waitForContext: "waitingForContext",
  initialize: "started",
  updateContext: "started",
  none: "started",
};

export const startupPhaseAfter = (startupAction: StartupAction, client: ConfigDirectorClient): StartupPhase => ({
  kind: startupPhaseKindAfter[startupAction],
  client,
});

type GivenContextAction =
  | { action: "skipUnchanged" }
  | { action: "keepForStartup" }
  | { action: "startClient"; client: ConfigDirectorClient }
  | { action: "updateContext"; client: ConfigDirectorClient };

export const decideGivenContextAction = (
  startupPhase: StartupPhase,
  lastGivenContext: ConfigDirectorContext | undefined,
  context: ConfigDirectorContext | undefined,
): GivenContextAction => {
  if (deepEqual(context, lastGivenContext)) {
    return { action: "skipUnchanged" };
  }
  switch (startupPhase.kind) {
    case "beforeFirstRenderEffects":
      return { action: "keepForStartup" };
    case "waitingForContext":
      return { action: "startClient", client: startupPhase.client };
    case "started":
      return { action: "updateContext", client: startupPhase.client };
  }
};
