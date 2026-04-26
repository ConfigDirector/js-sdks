import { defineEventHandler } from "h3";
import { useNitroApp } from "nitropack/runtime";
import type { ConfigDirectorClient } from "@configdirector/server-sdk";

export default defineEventHandler((event) => {
  event.context.configDirectorClient = useNitroApp().configDirectorClient;
});

declare module "h3" {
  interface H3EventContext {
    configDirectorClient: ConfigDirectorClient;
  }
}
