import type { ConfigDirectorContext, ConfigDirectorLogger } from "@js-browser-client/index";

export type ClientStatus = "loading" | "ready" | "default";

export type ConfigDirectorPluginOptions = {
  sdkKey: string;
  appName?: string;
  appVersion?: string;
  url?: string;
  timeout?: number;
  context?: ConfigDirectorContext;
  logger?: ConfigDirectorLogger;
};
