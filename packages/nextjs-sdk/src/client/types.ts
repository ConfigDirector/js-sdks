import type {
  ClientHooks,
  ConfigDirectorClient,
  ConfigDirectorContext,
  ConfigDirectorLoggingLevel,
  ConnectionMode,
} from "@js-browser-client/index";
import type { ConfigState } from "@shared/types";

export type { ConfigDirectorLoggingLevel };

export type ClientStatus = "loading" | "ready" | "default";

export interface ConfigDirectorContextData {
  client?: ConfigDirectorClient;
  updatedAt?: Date;
  status: ClientStatus;
  initialConfigs?: Record<string, ConfigState>;
}

export type ConfigDirectorProviderState = Omit<ConfigDirectorContextData, "initialConfigs">;

export type ConfigDirectorProviderOptions = {
  /**
   * Your ConfigDirector Client SDK key. This is a public value safe for the browser.
   */
  sdkKey: string;
  appName?: string;
  appVersion?: string;
  /**
   * Override the ConfigDirector client API base URL. Primarily useful for testing or proxying.
   */
  url?: string;
  /**
   * Initialization timeout in milliseconds. Defaults to 3000.
   */
  timeout?: number;
  /**
   * The connection mode, one of `streaming` or `polling`. In `streaming` mode the connection stays
   * open and receives config updates as they happen. In `polling` mode configs are fetched once during
   * initialization and then again on every `pollingInterval`. Defaults to `streaming`.
   */
  mode?: ConnectionMode;
  /**
   * The polling interval in seconds when `mode` is `polling`. Has no effect in `streaming` mode.
   * Defaults to 60 seconds. A value below the minimum of 30 seconds is raised to 30 seconds and a
   * warning is logged.
   */
  pollingInterval?: number;
  /**
   * Initial user context to evaluate targeting rules against.
   */
  context?: ConfigDirectorContext;
  /**
   * Log level for the console logger. Defaults to "warn".
   */
  logLevel?: ConfigDirectorLoggingLevel;

  hooks?: ClientHooks;
  /**
   * Pre-evaluated config states from the server, used to hydrate client components correctly
   * during SSR. Obtain these via {@link generateSsrConfigSet} or by using the
   * `ConfigDirectorProvider` exported from `@configdirector/nextjs-sdk/server`, which
   * populates this automatically.
   *
   * When the browser client is not yet ready (during SSR and the initial client render before
   * initialization completes), hooks will return values from this map rather than the default
   * value, avoiding a flash of wrong content on hydration.
   */
  initialConfigs?: Record<string, ConfigState>;
};
