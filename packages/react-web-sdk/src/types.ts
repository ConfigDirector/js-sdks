import type {
  ClientHooks,
  ConfigDirectorClient,
  ConfigDirectorContext,
  ConfigDirectorLogger,
  ConnectionMode,
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

/**
 * Props of a `ConfigDirectorProvider` given an existing client instead of the options to build one,
 * for example a test client's `client`.
 */
export type ConfigDirectorProviderClientProps = {
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
};

/**
 * Props of `ConfigDirectorProvider`: either the options to build a client from, or an existing client.
 */
export type ConfigDirectorProviderProps = ConfigDirectorProviderOptions | ConfigDirectorProviderClientProps;
