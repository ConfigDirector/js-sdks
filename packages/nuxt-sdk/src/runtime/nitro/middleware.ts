import { defineEventHandler } from "h3";
import { useNitroApp, useRuntimeConfig } from "nitropack/runtime";
import type { ConfigDirectorClient } from "@configdirector/server-sdk";
import type { ConnectionMode } from "@js-server-sdk/types";

export default defineEventHandler(async (event) => {
  const nitroApp = useNitroApp();
  const requestHold = decideRequestHold(
    useRuntimeConfig(event).configdirector.waitForInitialization,
    nitroApp.configDirectorConnectionMode,
  );
  if (requestHold === "hold-until-initialized") {
    await nitroApp.configDirectorInitialization;
  }
  event.context.configDirectorClient = nitroApp.configDirectorClient;
});

type RequestHold = "hold-until-initialized" | "pass-through";

const decideRequestHold = (
  waitForInitialization: boolean | undefined,
  connectionMode: ConnectionMode,
): RequestHold => {
  if (connectionMode === "offline") {
    return "hold-until-initialized";
  }
  return waitForInitialization ? "hold-until-initialized" : "pass-through";
};

declare module "h3" {
  interface H3EventContext {
    configDirectorClient: ConfigDirectorClient;
  }
}
