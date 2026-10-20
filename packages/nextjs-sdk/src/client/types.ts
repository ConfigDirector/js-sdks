import type {
  ClientHooks,
  ConfigDirectorClient,
  ConfigDirectorContext,
  ConfigDirectorLoggingLevel,
  ConnectionMode,
  OfflineValue,
  OfflineValues,
} from "@js-browser-client/index";
import type { ConfigState } from "@shared/types";

export type { ConfigDirectorLoggingLevel, OfflineValue, OfflineValues };

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
   * Your ConfigDirector Client SDK key. This is a public value safe for the browser. Required
   * unless `mode` is `offline`.
   */
  sdkKey?: string;
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
   * The connection mode, one of `streaming`, `polling` or `offline`. In `streaming` mode the connection
   * stays open and receives config updates as they happen. In `polling` mode configs are fetched once
   * during initialization and then again on every `pollingInterval`. In `offline` mode the browser
   * client never connects to ConfigDirector and sends nothing: it serves `values` to every context,
   * or the in-code default values when none are given, and needs no `sdkKey`. Defaults to `streaming`.
   *
   * The server `ConfigDirectorProvider` sets `offline` and `values` for you when `register()` ran in
   * `offline` mode and you give neither prop.
   */
  mode?: ConnectionMode;
  /**
   * The values to serve in `offline` mode, keyed by config key. The config type of each value follows
   * from the value: a boolean, an integral number (`integer`), any other number (`float`), a string, or
   * a plain object or array (`json`). Can be given only in `offline` mode; otherwise the client fails
   * to initialize.
   */
  values?: OfflineValues;
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

/**
 * Props of a client `ConfigDirectorProvider` given an existing client instead of the options to
 * build one, for example a test client's `client`.
 */
export type ConfigDirectorClientProviderClientProps = {
  /**
   * The client to provide. The provider never disposes it. If the client is not ready and not
   * initializing, the provider initializes it with `context`; if it is ready and `context` is given
   * and differs from the client's context, the provider updates the context; otherwise it leaves the
   * client as it is and reports ready as soon as the client is.
   */
  client: ConfigDirectorClient;
  context?: ConfigDirectorContext;
  /**
   * Event handlers registered on the client while the provider is mounted, and removed when it
   * unmounts.
   */
  hooks?: ClientHooks;
  /**
   * Pre-evaluated config states shown by the hooks until the client is ready.
   */
  initialConfigs?: Record<string, ConfigState>;
};

/**
 * Props of the client `ConfigDirectorProvider`: either the options to build a client from, or an
 * existing client.
 */
export type ConfigDirectorClientProviderProps = ConfigDirectorProviderOptions | ConfigDirectorClientProviderClientProps;
