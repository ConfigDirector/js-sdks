import type { ConfigDirectorClient, ConfigDirectorContext } from "@js-client-core/types";
import { decideMountAction } from "@js-client-core/mountAction";
import type { MountAction } from "@js-client-core/mountAction";

type StartupAction = MountAction | "waitForContext" | "firstStartInFlight";

export const decideStartupAction = (
  client: ConfigDirectorClient,
  context: ConfigDirectorContext | undefined,
  waitsForFirstContext: boolean,
): StartupAction => {
  const mountAction = decideMountAction(client, context);
  if (!waitsForFirstContext) {
    return mountAction;
  }
  if (mountAction === "initialize" && context === undefined) {
    return "waitForContext";
  }
  if (mountAction === "none" && client.isInitializing) {
    return "firstStartInFlight";
  }
  return mountAction;
};

type ContextUpdateAction = "startClient" | "updateContext";

export const decideContextUpdateAction = (
  client: ConfigDirectorClient,
  context: ConfigDirectorContext,
  waitsForFirstContext: boolean,
): ContextUpdateAction => {
  if (waitsForFirstContext && decideMountAction(client, context) === "initialize") {
    return "startClient";
  }
  return "updateContext";
};

export interface ClientStartup {
  waitsForFirstContext: boolean;
  start(context: ConfigDirectorContext): Promise<void>;
}
