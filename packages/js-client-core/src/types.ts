import { type EventProvider } from "./Emitter";
import type { UrlFactory, UrlLike } from "@shared/url";
import type {
  ConfigDirectorContext,
  ConfigDirectorMetaContext,
  ConfigDirectorLogger,
  IdentifyingSdkOptions,
  ConfigValueType,
  ConfigState,
  ConnectionMode,
  ConfigEvaluation,
} from "../../shared/src/types";
export * from "../../shared/src/types";

export type ConfigStateMap = {
  [key: string]: ConfigState;
};

export type ConfigSet = {
  environmentId: string;
  projectId: string;
  configs: ConfigStateMap;
  kind: "full" | "delta";
};

export type SdkMetaContext = IdentifyingSdkOptions & {
  userAgent?: string;
};

type ConnectionRetryDelayCalculator = (attempt: number) => number;

export type InternalClientOptions = {
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  connectionRetryDelay?: ConnectionRetryDelayCalculator;
  urlFactory?: UrlFactory;
};

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
     * The connection mode to be used, one of `streaming` (default) or `polling`.
     * If set to `streaming`, the connection will remain open and receive updates whenever
     * config state is updated on the ConfigDirector dashboard.
     * When set to `polling`, there will be an initial request to retrieve config state during
     * initialization, and additional requests on a `pollingInterval`.
     *
     * Defaults to `streaming`
     */
    mode?: ConnectionMode;
    /**
     * The polling interval in _seconds_ when the `mode` is set to `polling`. This option has no
     * effect when the `mode` is set to `streaming`.
     *
     * Defaults to 60 seconds
     */
    pollingInterval?: number;
    /**
     * The timeout, in _milliseconds_, to be used in initialization and when updating the context.
     * If streaming is enabled, the operation (initialization or context update) may still succeed
     * after it times out if no unrecoverable errors are encountered (like an invalid SDK key).
     * If streaming is disabled, if the operation times out, it will not be retried.
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
   * import { createClient, createConsoleLogger } from "@configdirector/client-sdk";
   * const client = createClient(
   *   "YOUR-SDK-KEY",
   *   { logger: createConsoleLogger("debug") },
   * );
   */
  logger?: ConfigDirectorLogger;

  /**
   * Handlers for hooks/events emitted by the client. Each hook accepts either a single event handler or
   * an array of event handlers.
   *
   * @example
   * import { createClient, createConsoleLogger } from "@configdirector/client-sdk";
   * const client = createClient(
   *   "YOUR-SDK-KEY",
   *   {
   *     hooks: {
   *       configEvaluated: (event) => { console.log(event.evaluation); }
   *     },
   *   },
   * );
   */
  hooks?: ClientHooks;
};

export type ClientHooks = {
  clientReady?: HookHandler<"clientReady"> | HookHandler<"clientReady">[];
  configsUpdated?: HookHandler<"configsUpdated"> | HookHandler<"configsUpdated">[];
  contextUpdated?: HookHandler<"contextUpdated"> | HookHandler<"contextUpdated">[];
  configEvaluated?: HookHandler<"configEvaluated"> | HookHandler<"configEvaluated">[];
  connectionError?: HookHandler<"connectionError"> | HookHandler<"connectionError">[];
};

export type ClientConnectAction = "initialization" | "context update" | "network resume";

export type HookHandler<TEvent extends keyof ClientEvents> = (payload: ClientEvents[TEvent]) => void;

export type ClientEvents = {
  configsUpdated: { keys: string[] };
  clientReady: { action: ClientConnectAction };
  contextUpdated: { context: ConfigDirectorContext | undefined };
  configEvaluated: { evaluation: ConfigEvaluation };
  connectionError: { error: Error };
};

export type WatchHandler<T extends ConfigValueType> = (message: T) => void;

/**
 * The ConfigDirector SDK client object.
 *
 * Applications should create a single instance of `ConfigDirectorClient`, and call
 * {@link initialize} during application initialization.
 *
 * After initialization, to update the user's context, so that targeting rules are evaluated
 * with the updated context, call {@link updateContext}.
 */
export interface ConfigDirectorClient extends EventProvider<ClientEvents> {
  /**
   * Initializes the connection to ConfigDirector to retrieve config evaluations. Until
   * initialization is successful, all flags will return their default value provided to
   * {@link watch} or {@link getValue}.
   *
   * If the connection fails or is interrupted with a transient error (network error,
   * internal server error, etc) the client will continue to attempt to connect. However,
   * if the connection fails with a persistent error, like an invalid SDK key, the client will
   * not attempt to re-connect and an error will be logged to the console or the provided
   * logger.
   *
   * @param context The current user's context to be used for evaluating targeting rules (optional).
   */
  initialize(context?: ConfigDirectorContext): Promise<void>;

  /**
   * Updates the user's context and re-evaluates all config and flag values based on the new context.
   *
   * @param context The current user's context to be used for evaluating targeting rules (required).
   */
  updateContext(context: ConfigDirectorContext): Promise<void>;

  /**
   * Returns the current context the client is configured with, or undefined if there is no context.
   *
   * Note that the value returned does not updated immediately after calling {@link updateContext}. Only
   * once the underlying connection was successful or timed out, the current context is updated. This is
   * because while the context update is in progress, configs are still evaluated on the previous context.
   *
   */
  get context(): ConfigDirectorContext | undefined;

  /**
   * Returns whether or not the client is ready after calling {@link initialize} or {@link updateContext}
   *
   * The definition of ready is that the connection to the server was successful, and config state
   * was received.
   */
  get isReady(): boolean;

  /**
   * Returns whether or not the client is currently initializing. Upon client creation, it is `false`.
   * It is `true` after calling `initialize` and becomes `false` again once initialization is completed.
   */
  get isInitializing(): boolean;

  /**
   * Evaluates a config and returns its value based on the current context and targeting rules
   *
   * @returns The evaluated config value, or the `defaultValue` if the config state was unavailable
   * @param configKey The config key to evaluate
   * @param defaultValue The default value to be returned if the config state is unavailable. For
   * example, if the client cannot connect to the server due to network conditions, or if getValue
   * is called before initialization is done.
   */
  getValue<T extends ConfigValueType>(configKey: string, defaultValue: T): T;

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
   */
  watch<T extends ConfigValueType>(configKey: string, defaultValue: T, callback: WatchHandler<T>): () => void;

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
   * Pauses the network connection without clearing event handlers, watch handlers, or config
   * state. Intended for mobile environments where the OS may kill background connections (e.g.
   * when the app is backgrounded on iOS/Android).
   *
   * Call {@link resumeNetwork} to re-establish the connection.
   */
  pauseNetwork(): void;

  /**
   * Resumes a connection that was paused via {@link pauseNetwork}, using the last context that
   * was provided to {@link initialize} or {@link updateContext}.
   */
  resumeNetwork(): Promise<void>;

  /**
   * Disposes of the client. All connections are closed, and all event and config key subscribers
   * are removed.
   *
   * Intended to be called when your application shuts down
   */
  dispose(): void;
}

export type TransportOptions = {
  clientSdkKey: string;
  baseUrl: UrlLike;
  resolveUrl: UrlFactory;
  metaContext: ConfigDirectorClientOptions["metadata"] & SdkMetaContext;
  instanceId: string;
  logger: ConfigDirectorLogger;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  connectionRetryDelay: ConnectionRetryDelayCalculator;
  pollingInterval?: number;
};

export type TransportEvents = {
  configSetReceived: ConfigSet;
  connectionError: Error;
};

export interface Transport extends EventProvider<TransportEvents> {
  connect(context: ConfigDirectorContext, timeout: number): Promise<this>;
  close(): void;
  dispose(): void;
}
