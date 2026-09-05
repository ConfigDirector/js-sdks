import { Emitter } from "./Emitter";
import { StreamingTransport } from "./StreamingTransport";
import { getRequestedType, parseConfigValue } from "../../shared/src/value-parser";
import type {
  ConfigSet,
  ConfigState,
  ConfigStateMap,
  ConfigDirectorContext,
  ConfigDirectorClientOptions,
  ConfigDirectorClient,
  ClientEvents,
  WatchHandler,
  ConfigValueType,
  ConfigDirectorLogger,
  Transport,
  ClientConnectAction,
  IdentifyingSdkOptions,
  InternalClientOptions,
  ConnectionMode,
  ConfigEvaluation,
  HookHandler,
} from "./types";
import { createDefaultLogger } from "./logger";
import { ConfigDirectorValidationError } from "./errors";
import { OneTimeTransport } from "./OneTimeTransport";
import type { TelemetryClient } from "./telemetry";
import { defaultUrlFactory } from "@shared/url";
import type { UrlFactory, UrlLike } from "@shared/url";
import { CLIENT_BASE_URL } from "@shared/constants";
import { generateInstanceId } from "@shared/instance-id";
import { PollingTransport } from "./PollingTransport";
const MAX_EXPONENTIAL_DELAY = 9; // 2^9 = 512 seconds, to cap it to under 10min

type WatchHandlerWithOptions<T extends ConfigValueType> = {
  handler: WatchHandler<T>;
  defaultValue: T;
  requestedType: string;
};

export class DefaultConfigDirectorClient implements ConfigDirectorClient {
  private logger: ConfigDirectorLogger;
  private telemetryClient: TelemetryClient;
  private configSet: ConfigSet | undefined;
  private handlersMap: Map<string, WatchHandlerWithOptions<any>[]> = new Map();
  private transport: Transport;
  private eventEmitter = new Emitter<ClientEvents>();
  private timeout: number;
  private timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private ready = false;
  private initializing = false;
  private readyPromise: Promise<void> | undefined;
  private readyResolve: ((cancelled?: boolean) => void) | undefined;
  private currentContext?: ConfigDirectorContext;
  private connectionMode: ConnectionMode;
  private instanceId: string;

  constructor(
    telemetryClient: TelemetryClient,
    clientSdkKey: string,
    sdkOptions: IdentifyingSdkOptions,
    clientOptions?: ConfigDirectorClientOptions,
    internalClientOptions?: InternalClientOptions,
  ) {
    this.instanceId = generateInstanceId();
    this.logger = clientOptions?.logger ?? createDefaultLogger();
    this.timeout = clientOptions?.connection?.timeout ?? 3_000;
    this.validateSdkKeyPresence(clientSdkKey);
    const urlFactory: UrlFactory = internalClientOptions?.urlFactory ?? defaultUrlFactory;
    const baseUrl = this.parseUrl(clientOptions?.connection?.url, urlFactory) ?? CLIENT_BASE_URL;
    this.connectionMode = clientOptions?.connection?.mode ?? "streaming";
    const transportConstructor = this.getTransportConstructor(this.connectionMode);
    this.telemetryClient = telemetryClient;
    this.transport = new transportConstructor({
      instanceId: this.instanceId,
      clientSdkKey,
      baseUrl,
      resolveUrl: urlFactory,
      metaContext: {
        ...clientOptions?.metadata,
        sdkName: sdkOptions.sdkName,
        sdkVersion: sdkOptions.sdkVersion,
        userAgent: navigator?.userAgent,
      },
      logger: this.logger,
      fetch: internalClientOptions?.fetch,
      connectionRetryDelay:
        internalClientOptions?.connectionRetryDelay ??
        ((attempt: number) => {
          const seconds = Math.pow(2, Math.min(attempt, MAX_EXPONENTIAL_DELAY));
          return seconds * 1_000;
        }),
      pollingInterval: clientOptions?.connection?.pollingInterval,
    });

    this.transport.on("configSetReceived", (configSet: ConfigSet) => {
      this.readyResolve?.();
      const configKeys = Object.keys(configSet.configs);
      if (!this.configSet || configSet.kind == "full") {
        this.configSet = configSet;
        this.emit("configsUpdated", { keys: configKeys });
        this.updateWatchers(configSet.configs);
      } else {
        this.configSet.configs = {
          ...this.configSet.configs,
          ...configSet.configs,
        };
        this.emit("configsUpdated", { keys: configKeys });
        this.updateWatchers(configSet.configs);
      }
      this.logger.debug("[ConfigDirectorClient] ConfigSet updated from server:", { keys: configKeys });
    });

    this.registerHandler("clientReady", clientOptions?.hooks?.clientReady);
    this.registerHandler("configEvaluated", clientOptions?.hooks?.configEvaluated);
    this.registerHandler("configsUpdated", clientOptions?.hooks?.configsUpdated);
    this.registerHandler("contextUpdated", clientOptions?.hooks?.contextUpdated);
  }

  private registerHandler<T extends keyof ClientEvents>(
    event: T,
    handler: HookHandler<T> | HookHandler<T>[] | undefined,
  ) {
    if (!handler) {
      return;
    }

    const handlers = Array.isArray(handler) ? handler : [handler];
    for (const h of handlers) {
      if (typeof h === "function") {
        this.on(event, h);
      }
    }
  }

  private getTransportConstructor(connectionMode?: ConnectionMode) {
    switch (connectionMode) {
      case "one-time":
        return OneTimeTransport;
      case "polling":
        return PollingTransport;
      default:
        return StreamingTransport;
    }
  }

  public async initialize(context?: ConfigDirectorContext) {
    this.initializing = true;
    await this.connectToTransport(context, "initialization");
  }

  public async updateContext(context: ConfigDirectorContext) {
    await this.connectToTransport(context, "context update");
  }

  public get context(): ConfigDirectorContext | undefined {
    return this.currentContext;
  }

  private async connectToTransport(context: ConfigDirectorContext | undefined, caller: ClientConnectAction) {
    try {
      this.ready = false;
      this.readyPromise = new Promise<boolean | undefined>((resolve) => {
        this.readyResolve = resolve;
      }).then((cancelled) => {
        if (cancelled) {
          return;
        }
        this.ready = true;
        this.initializing = false;
        this.emit("clientReady", { action: caller });
        this.logger.debug("[ConfigDirectorClient] Received initial payload from the server, client is ready");
      });
      const startTime = new Date().getTime();
      await this.transport.connect(context ?? {}, this.timeout);
      this.currentContext = context;
      this.telemetryClient.updateContext(context);
      this.emit("contextUpdated", { context });

      const elapsedTime = new Date().getTime() - startTime;
      const remainingTimeout = this.timeout - elapsedTime;
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = undefined;
      if (remainingTimeout > 0) {
        await Promise.race([
          this.readyPromise,
          new Promise<void>((resolve) => {
            this.timeoutTimer = setTimeout(() => resolve(), remainingTimeout);
          }),
        ]).finally(() => clearTimeout(this.timeoutTimer));
      }

      if (!this.ready) {
        const warningDetails =
          "The client will continue to retry since there were no fatal errors detected. Configs will return the default value until the connection succeeds.";
        this.logger.warn(
          `[ConfigDirectorClient] Timed out waiting for ${caller} after ${this.timeout}ms. ${warningDetails}`,
        );
      }
    } catch (error) {
      this.logger.error(`[ConfigDirectorClient] An error occurred during ${caller}: `, error);
    }
  }

  private updateWatchers(configsMap: ConfigStateMap) {
    Object.values(configsMap).forEach((v) => this.updateWatchersForConfig(v));
  }

  private updateWatchersForConfig(configState: ConfigState) {
    this.handlersMap.get(configState.key)?.forEach((h) => {
      const value = this.getValueFromConfigState(configState.key, configState, h.defaultValue);
      h.handler(value);
    });
  }

  public watch<T extends ConfigValueType>(configKey: string, defaultValue: T, callback: WatchHandler<T>) {
    this.validateDefaultValue(defaultValue);

    const handlers = this.handlersMap.get(configKey);
    const handlerWithOptions = { handler: callback, defaultValue, requestedType: typeof defaultValue };
    if (handlers) {
      handlers.push(handlerWithOptions);
    } else {
      this.handlersMap.set(configKey, [handlerWithOptions]);
    }

    return () => this.unwatch(configKey, callback);
  }

  public unwatch<T extends ConfigValueType>(configKey: string, callback?: WatchHandler<T>) {
    const handlers = this.handlersMap.get(configKey);
    if (!handlers) {
      return;
    }

    if (callback) {
      const index = handlers.findIndex((h) => h.handler == callback);
      if (index >= 0) {
        handlers?.splice(index, 1);
      }
    } else {
      handlers.splice(0);
    }
  }

  public getValue<T extends ConfigValueType>(configKey: string, defaultValue: T): T {
    this.validateDefaultValue(defaultValue);

    const configState = this.configSet?.configs[configKey];
    return this.getValueFromConfigState(configKey, configState, defaultValue);
  }

  private getValueFromConfigState<T extends ConfigValueType>(
    configKey: string,
    configState: ConfigState | undefined,
    defaultValue: T,
  ): T {
    if (!configState) {
      this.logger.debug(
        `[ConfigDirectorClient] No config state found for '${configKey}', returning default value '${defaultValue}'`,
      );
      const reason = this.isReady ? "config-state-missing" : "client-not-ready";
      this.telemetryClient.evaluatedConfig({
        contextId: this.currentContext?.id,
        key: configKey,
        defaultValue: defaultValue,
        requestedType: getRequestedType(defaultValue),
        evaluatedValue: defaultValue,
        usedDefault: true,
        evaluationReason: reason,
      });
      this.dispatchEvaluationEvent({
        key: configKey,
        value: defaultValue,
        isDefaultValue: true,
        reason,
        context: this.context,
      });
      return defaultValue;
    }

    const parseResult = parseConfigValue<T>(configState, defaultValue);
    this.telemetryClient.evaluatedConfig({
      contextId: this.currentContext?.id,
      type: configState.type,
      key: configKey,
      defaultValue: defaultValue,
      requestedType: parseResult.requestedType,
      evaluatedValue: parseResult.parsedValue,
      evaluatedValueId: parseResult.parsedValueId,
      usedDefault: parseResult.usedDefault,
      evaluationReason: parseResult.reason,
    });
    this.dispatchEvaluationEvent({
      key: configKey,
      value: parseResult.parsedValue,
      valueId: parseResult.parsedValueId ?? undefined,
      isDefaultValue: parseResult.usedDefault,
      reason: parseResult.reason,
      context: this.context,
    });
    this.logger.debug(`[ConfigDirectorClient] Evaluated '${configKey}' to '${parseResult.parsedValue}'`);
    return parseResult.parsedValue;
  }

  private dispatchEvaluationEvent(event: ConfigEvaluation) {
    setTimeout(() => this.emit("configEvaluated", { evaluation: event }), 0);
  }

  private emit<TName extends keyof ClientEvents>(name: TName, payload: ClientEvents[TName]) {
    try {
      this.eventEmitter.emit(name, payload);
    } catch (error) {
      this.logger.error(`[ConfigDirectorClient] Error executing event handlers for '${name}'`, error);
    }
  }

  private parseUrl(url: string | undefined, urlFactory: UrlFactory): UrlLike | undefined {
    if (!url) {
      return;
    }

    try {
      return urlFactory(url);
    } catch (error) {
      throw new ConfigDirectorValidationError(`Invalid base URL '${url}'. Parsing failed: ${error}`);
    }
  }

  private validateSdkKeyPresence(sdkKey: string | null | undefined) {
    if (!sdkKey || sdkKey.trim().length == 0) {
      throw new ConfigDirectorValidationError(
        "No client SDK key was provided, the client cannot be instantiated without a valid client SDK key",
      );
    }
  }

  private validateDefaultValue<T extends ConfigValueType>(defaultValue: T) {
    if (defaultValue === undefined || defaultValue === null) {
      throw new ConfigDirectorValidationError(
        "Invalid default value. The default value for a config must be defined and non-null.",
      );
    }

    if (typeof defaultValue === "function") {
      throw new ConfigDirectorValidationError(
        "Invalid default value. The default value for a config cannot be a function.",
      );
    }
  }

  public get isReady(): boolean {
    return this.ready;
  }

  public get isInitializing(): boolean {
    return this.initializing;
  }

  public on<T extends keyof ClientEvents>(eventName: T, handler: (event: ClientEvents[T]) => void): void {
    this.eventEmitter.on(eventName, handler);
  }

  public off<T extends keyof ClientEvents>(eventName: T, handler?: (payload: ClientEvents[T]) => void) {
    this.eventEmitter.off(eventName, handler);
  }

  public clear() {
    this.logger.debug("[ConfigDirectorClient] clear() has been called, removing all observers");
    this.eventEmitter.clear();
    this.handlersMap.clear();
  }

  public unwatchAll() {
    this.handlersMap.clear();
  }

  public pauseNetwork(): void {
    this.logger.debug("[ConfigDirectorClient] pauseNetwork() called, pausing transport connection");
    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = undefined;
    this.transport.close();
    this.ready = false;
  }

  public async resumeNetwork(): Promise<void> {
    await this.connectToTransport(this.currentContext, "network resume");
  }

  public async close() {
    this.logger.debug("[ConfigDirectorClient] close() has been called, closing connection to server");
    clearTimeout(this.timeoutTimer);
    this.readyResolve?.(true);
    this.telemetryClient.close();
    this.transport.close();
    this.ready = false;
    this.initializing = false;
  }

  public dispose() {
    this.clear();
    this.close();
  }
}
