import type {
  CachingOptions,
  ClientHooks,
  ConfigDirectorClient,
  ConfigDirectorContext,
  ConfigDirectorLogger,
  ConnectionMode,
  OfflineValue,
  OfflineValues,
} from "@js-client-core/index";

export type { OfflineValue, OfflineValues };

export type ClientStatus = "loading" | "ready" | "default";

export interface ConfigDirectorContextData {
  client?: ConfigDirectorClient;
  updatedAt?: Date;
  status: ClientStatus;
}

export type ConfigDirectorProviderState = ConfigDirectorContextData;

/** Minimal connectivity state shape consumed from @react-native-community/netinfo */
export type NetInfoState = { isConnected: boolean | null };

/**
 * A subscription function with the same signature as `NetInfo.addEventListener` from
 * `@react-native-community/netinfo`. Pass this prop to enable immediate reconnection
 * when the device regains network connectivity instead of waiting for the next
 * exponential-backoff retry.
 *
 * @example
 * import NetInfo from '@react-native-community/netinfo';
 * <ConfigDirectorProvider netInfoSubscribe={NetInfo.addEventListener} ... />
 */
export type NetInfoSubscribe = (callback: (state: NetInfoState) => void) => () => void;

export type ConfigDirectorProviderOptions = {
  /**
   * Your ConfigDirector client SDK key. Required unless `mode` is `offline`.
   */
  sdkKey?: string;
  appName?: string;
  appVersion?: string;
  url?: string;
  timeout?: number;
  /**
   * The connection mode, one of `streaming`, `polling` or `offline`. In `streaming` mode the connection
   * stays open and receives config updates as they happen. In `polling` mode configs are fetched once
   * during initialization and then again on every `pollingInterval`. In `offline` mode the client never
   * connects to ConfigDirector and sends nothing: it serves `values` to every context, or the in-code
   * default values when none are given, and needs no `sdkKey`.
   *
   * Defaults to `streaming`.
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
   *
   * Defaults to 60 seconds. A value below the minimum of 30 seconds is raised to 30 seconds and a
   * warning is logged.
   */
  pollingInterval?: number;
  context?: ConfigDirectorContext;
  logger?: ConfigDirectorLogger;
  hooks?: ClientHooks;
  /**
   * Options for the values the client keeps on the device between launches. The last values received
   * are kept by default and served, with the evaluation reason `cached`, on the next launch of the same
   * context until live values arrive.
   */
  caching?: CachingOptions;
  netInfoSubscribe?: NetInfoSubscribe;
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
  netInfoSubscribe?: NetInfoSubscribe;
};

/**
 * Props of `ConfigDirectorProvider`: either the options to build a client from, or an existing client.
 */
export type ConfigDirectorProviderProps = ConfigDirectorProviderOptions | ConfigDirectorProviderClientProps;
