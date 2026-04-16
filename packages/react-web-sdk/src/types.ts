import type {
  ConfigDirectorClient,
  ConfigDirectorContext,
  ConfigDirectorLogger,
} from "@js-browser-client/index";

export type ClientStatus = "loading" | "ready" | "default";

export interface ConfigDirectorContextData {
  client?: ConfigDirectorClient;
  updatedAt?: Date;
  status: ClientStatus;
}

export type ConfigDirectorProviderState = ConfigDirectorContextData;

export type ConfigDirectorProviderOptions = {
  sdkKey: string;
  appName?: string;
  appVersion?: string;
  url?: string;
  timeout?: number;
  context?: ConfigDirectorContext;
  logger?: ConfigDirectorLogger;
};
