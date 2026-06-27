import type {
  ConfigDirectorContext,
  ConfigDirectorMetaContext,
  ConfigDirectorLogger,
  ConfigValueType,
  ConfigState,
  IdentifyingSdkOptions,
  ConnectionMode,
  ConfigEvaluation,
} from "@shared/types";
import type { Config } from "@config-evaluator/types";
export type {
  ConfigDirectorLogger,
  ConfigDirectorContext,
  ConfigDirectorMetaContext,
  ConfigState,
  ConfigValueType,
  ConfigType,
  ConnectionMode,
  EvaluationReason,
  ConfigEvaluation,
  IdentifyingSdkOptions,
} from "@shared/types";

/**
 * Configuration options for the {@link ConfigDirectorClient}
 */
export type ConfigDirectorClientOptions = {
  /**
   * Application metadata that remains constant through the lifetime of the connection
   */
  metadata?: ConfigDirectorMetaContext;
  /**
   * Connection options
   */
  connection?: {
    /**
     * The connection mode to be used, one of `streaming` (default), `polling`, or `one-time`.
     * If set to `streaming`, the connection will remain open and receive updates whenever
     * config state is updated on the ConfigDirector dashboard.
     * When set to `polling`, there will be an initial request to retrieve config state during
     * initialization, and additional requests on a `pollingInterval`.
     * The `one-time` connection mode will only retrieve config state during initialization. It
     * will not poll for regular updates.
     *
     * Defaults to `streaming`
     */
    mode?: ConnectionMode;
    /**
     * The polling interval in _seconds_ when the `mode` is set to `polling`. This option has no
     * effect when the `mode` is set to `streaming` or `one-time`.
     *
     * Defaults to 60 seconds
     */
    pollingInterval?: number;
    /**
     * The timeout, in milliseconds, to be used in initialization and when updating the context.
     * If streaming is enabled, the operation (initialization or context update) may still succeed
     * after it times out if no unrecoverable errors are encountered (like an invalid SDK key).
     * If streaming is disabled, if the operation times out, it will not be retried.
     *
     * Defaults to 3,000 milliseconds (3 seconds)
     */
    timeout?: number;
    /**
     * The base URL to the ConfigDirector SDK server. To be used only when needing to route through a
     * proxy to connect to the ConfigDirector SDK server. Please refer to the docs on how to configure
     * a proxy for the client SDK.
     */
    url?: string;
  };
  /**
   * A logger that implements {@link ConfigDirectorLogger}. It defaults to the ConfigDirector console
   * logger set to 'warn' level.
   *
   * The log level of the default logger can be adjusted by creating a default logger with the desired
   * level and providing it in this property:
   * @example
   * import { createClient, createConsoleLogger } from "@configdirector/server-sdk";
   * const client = createClient(
   *   "YOUR-SERVER-SDK-KEY",
   *   { logger: createConsoleLogger("debug") },
   * );
   */
  logger?: ConfigDirectorLogger;

  /**
   * Telemetry tunning. It is unlikely these settings need to be adjusted. However, in cases where
   * your application has a large number of evaluations per second, you can adjust these settings
   * to tune the memory footprint and frequency of telemetry requests.
   * Keep in mind that ConfigDirector relies on these telemetry events to provide insights and features
   * related to the configs being used.
   */
  telemetry?: {
    /**
     * The size limit of telemetry event queues. If the size limit is reached before the events are
     * flushed to the network, older events will be dropped.
     *
     * ConfigDirector keeps a count of dropped events. If the number of dropped events is higher than
     * 50% of the total events, ConfigDirector will issue a notification alert in the dashboard.
     *
     * A number between 100 and 100,000. Defaults to 5,000.
     */
    eventQueueLimit?: number;

    /**
     * How often events are flushed and sent over the network in milliseconds.
     *
     * Decrease this number if your application consistently captures a large number of events in short
     * periods of time in order to reduce memory footprint from a large event queue.
     *
     * Defaults to 30,000 milliseconds (30 seconds)
     */
    flushInterval?: number;
  };

  /**
   * Handlers for hooks/events emitted by the client. Each hook accepts either a single event handler or
   * an array of event handlers.
   *
   * @example
   * import { createClient, createConsoleLogger } from "@configdirector/server-sdk";
   * const client = createClient(
   *   "YOUR-SERVER-SDK-KEY",
   *   {
   *     hooks: {
   *       configEvaluated: (event) => { console.log(event.evaluation); }
   *     },
   *   },
   * );
   */
  hooks?: ClientHooks;
};

export type ClientEvents = {
  configsUpdated: { keys: string[] };
  clientReady: undefined;
  configEvaluated: { evaluation: ConfigEvaluation };
};

export type ClientHooks = {
  clientReady?: HookHandler<"clientReady"> | HookHandler<"clientReady">[];
  configsUpdated?: HookHandler<"configsUpdated"> | HookHandler<"configsUpdated">[];
  configEvaluated?: HookHandler<"configEvaluated"> | HookHandler<"configEvaluated">[];
};

export type HookHandler<TEvent extends keyof ClientEvents> = (payload: ClientEvents[TEvent]) => void;

export type WatchHandler<T extends ConfigValueType> = (message: T) => void;

/**
 * The ConfigDirector SDK client object.
 *
 * Applications should create a single instance of `ConfigDirectorClient`, and call
 * {@link initialize} during application initialization.
 */
export interface ConfigDirectorClient {
  /**
   * Initializes the connection to ConfigDirector to retrieve config definitions. Until
   * initialization is successful, all flags will return their default value provided to
   * {@link watch} or {@link getValue}.
   *
   * If the connection fails or is interrupted with a transient error (network error,
   * internal server error, etc) the client will continue to attempt to connect. However,
   * if the connection fails with a persistent error, like an invalid SDK key, the client will
   * not attempt to re-connect and an error will be logged to the console or the provided
   * logger.
   */
  initialize(): Promise<void>;

  /**
   * Returns whether or not the client is ready after calling {@link initialize}
   *
   * The definition of ready is that the connection to the server was successful, and config definitions
   * were received.
   */
  get isReady(): boolean;

  /**
   * Evaluates a config and returns its value based on the current context and targeting rules
   *
   * @returns The evaluated config value, or the `defaultValue` if the config state was unavailable
   * @param configKey The config key to evaluate
   * @param defaultValue The default value to be returned if the config state is unavailable. For
   * example, if the client cannot connect to the server due to network conditions, or if getValue
   * is called before initialization is done.
   * @param context The user's context to be used for targeting rules evaluation (optional)
   */
  getValue<T extends ConfigValueType>(configKey: string, defaultValue: T, context?: ConfigDirectorContext): T;

  /**
   * Watches for changes to a a config evaluation value. Whenever the config value changes, the
   * provided callback function will be called with the new value. Changes can happen due to updates
   * to the config in the ConfigDirector dashboard, or if the context is updated via {@link updateContext}.
   *
   * @returns An 'unwatch' function that can be called to remove the subscriber
   *
   * @param configKey The config key to watch
   * @param defaultValue The default value to be referenced if the config state is unavailable
   * @param callback The callback function to be called whenever the config value is updated
   * @param context The user's context to be used for targeting rules evaluation (optional)
   */
  watch<T extends ConfigValueType>(
    configKey: string,
    defaultValue: T,
    callback: WatchHandler<T>,
    context?: ConfigDirectorContext,
  ): () => void;

  /**
   * Removes a particular subscriber to the given `configKey`, or all subscribers if no callback
   * is provided.
   *
   * @param configKey The config key to remove subscribers from
   * @param callback The subscriber to be removed. If not provided, all subscribers are removed for
   * the given `configKey`.
   */
  unwatch<T extends ConfigValueType>(configKey: string, callback?: WatchHandler<T>): void;

  /**
   * Removes all subscribers from all config keys
   */
  unwatchAll(): void;

  /**
   * Returns the evaluated {@link ConfigState} for every known config key, or only the keys
   * listed in `configKeys` when provided.
   *
   * Intended for SSR hydration — does NOT record telemetry events. Returns an empty object
   * when the client is not yet ready.
   */
  getAllConfigs(options?: {
    context?: ConfigDirectorContext;
    configKeys?: string[];
  }): Record<string, ConfigState>;

  on<T extends keyof ClientEvents>(eventName: T, handler: (args: ClientEvents[T]) => void): void;

  off<T extends keyof ClientEvents>(eventName: T, handler?: (args: ClientEvents[T]) => void): void;

  /**
   * Disposes of the client. All connections are closed, and all event and config key subscribers
   * are removed.
   *
   * Intended to be called when your application shuts down
   */
  dispose(): void;
}

export type TransportEvents = {
  configBundleReceived: ConfigBundle;
};

export type TransportOptions = {
  serverSdkKey: string;
  baseUrl: URL;
  metaContext: ConfigDirectorClientOptions["metadata"] & IdentifyingSdkOptions;
  logger: ConfigDirectorLogger;
  pollingInterval?: number;
};

export interface Transport {
  connect(timeout: number): Promise<this>;
  get isConnected(): boolean;
  on<TName extends keyof TransportEvents>(
    name: TName,
    handler: (payload: TransportEvents[TName]) => void,
  ): void;
  off<TName extends keyof TransportEvents>(
    name: TName,
    handler?: ((payload: TransportEvents[TName]) => void) | undefined,
  ): void;
  close(): void;
  dispose(): void;
}

export type ConfigDefinition = Config;
export type ConfigBundle = {
  configs: Record<string, ConfigDefinition>;
  environmentId: string;
  projectId: string;
  kind: "full" | "delta";
};
