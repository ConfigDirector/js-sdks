import type {
  ClientHooks,
  ConfigDirectorContext,
  ConfigDirectorLogger,
  ConnectionMode,
} from "@js-browser-client/index";

export type ClientStatus = "loading" | "ready" | "default";

export type ConfigDirectorPluginOptions = {
  sdkKey: string;
  appName?: string;
  appVersion?: string;
  url?: string;
  timeout?: number;
  /**
   * The connection mode, one of `streaming` or `polling`. In `streaming` mode the connection stays
   * open and receives config updates as they happen. In `polling` mode configs are fetched once during
   * initialization and then again on every `pollingInterval`.
   *
   * Defaults to `streaming`.
   */
  mode?: ConnectionMode;
  /**
   * The polling interval in seconds when `mode` is `polling`. Has no effect in `streaming` mode.
   *
   * Defaults to 60 seconds. A value below the minimum of 30 seconds is raised to 30 seconds and a
   * warning is logged.
   */
  pollingInterval?: number;
  context?: ConfigDirectorContext;
  logger?: ConfigDirectorLogger;
  hooks?: ClientHooks;
};
