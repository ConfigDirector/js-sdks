import { defineEventHandler } from "h3";
import { useNitroApp, useRuntimeConfig } from "nitropack/runtime";
import type { ConfigDirectorClient } from "@configdirector/server-sdk";

export default defineEventHandler(async (event) => {
  const nitroApp = useNitroApp();
  if (useRuntimeConfig(event).configdirector.waitForInitialization) {
    await nitroApp.configDirectorInitialization;
  }
  event.context.configDirectorClient = nitroApp.configDirectorClient;
});

declare module "h3" {
  interface H3EventContext {
    configDirectorClient: ConfigDirectorClient;
  }
}
