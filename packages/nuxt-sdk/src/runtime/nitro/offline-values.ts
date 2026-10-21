import { createError, defineEventHandler } from "h3";
import { useNitroApp } from "nitropack/runtime";
import { offlineValuesOf } from "@shared/browser-half";

export default defineEventHandler(() => {
  const nitroApp = useNitroApp();
  if (nitroApp.configDirectorConnectionMode !== "offline") {
    throw createError({ statusCode: 404 });
  }
  return offlineValuesOf(nitroApp.configDirectorClient.getAllConfigs());
});
