import { consola } from "consola";
import type { ConfigDirectorLogger } from "@shared/types";

export const createDefaultLogger = (level?: number): ConfigDirectorLogger => {
  const logger = consola.withTag("configdirector-nuxt-sdk");
  if (level !== undefined) {
    logger.level = level;
  }
  return logger;
};
