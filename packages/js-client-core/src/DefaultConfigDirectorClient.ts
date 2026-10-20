import { Emitter } from "./Emitter";
import { StreamingTransport } from "./StreamingTransport";
import { OfflineTransport } from "./OfflineTransport";
import { planConnection, type ConnectionPlan, type LiveConnectionMode } from "./connection-plan";
import { getRequestedType, parseConfigValue } from "../../shared/src/value-parser";
import type {
  ConfigSet,
  ConfigState,
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
  ConfigEvaluation,
  HookHandler,
  ClientSession,
  OfflineClientOptions,
} from "./types";
import { createDefaultLogger } from "./logger";
import { ConfigDirectorInitializationError, ConfigDirectorValidationError } from "./errors";
import type { LiveTelemetryClientFactory, TelemetryClient } from "./telemetry";
import { discardingTelemetryClient } from "./telemetry/discarding";
import { defaultUrlFactory } from "@shared/url";
import type { UrlFactory } from "@shared/url";
import { CLIENT_DEFAULT_POLLING_INTERVAL_SECONDS, CLIENT_MIN_POLLING_INTERVAL_SECONDS } from "@shared/constants";
import { resolvePollingInterval } from "@shared/transport/pollingInterval";
import { resolveClientSession } from "./client-session";
import { PollingTransport } from "./PollingTransport";
import { readHost, readUserAgent } from "./browser-globals";
import { admitContext } from "@shared/context-kind";
const MAX_EXPONENTIAL_DELAY = 9; // 2^9 = 512 seconds, to cap it to under 10min

type ContextSubmission = Exclude<ClientConnectAction, "network resume">;

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
  private hasReceivedConfigSet = false;
  private readyPromise: Promise<void> | undefined;
  private readyResolve: ((cancelled?: boolean) => void) | undefined;
  private currentContext?: ConfigDirectorContext;
  private readonly connectionPlan: ConnectionPlan;
  private clientSession: Promise<ClientSession>;

  public static from(
    liveTelemetryClient: LiveTelemetryClientFactory,
    clientSdkKeyOrOptions: string | OfflineClientOptions | undefined,
    sdkOptions: IdentifyingSdkOptions,
    clientOptions: ConfigDirectorClientOptions | undefined,
  ): DefaultConfigDirectorClient {
    if (typeof clientSdkKeyOrOptions === "object") {
      return new DefaultConfigDirectorClient(liveTelemetryClient, undefined, sdkOptions, clientSdkKeyOrOptions);
    }
    return new DefaultConfigDirectorClient(liveTelemetryClient, clientSdkKeyOrOptions, sdkOptions, clientOptions);
  }

  constructor(
    liveTelemetryClient: LiveTelemetryClientFactory,
    clientSdkKey: string | undefined,
    sdkOptions: IdentifyingSdkOptions,
    clientOptions?: ConfigDirectorClientOptions,
    internalClientOptions?: InternalClientOptions,
  ) {
    this.logger = clientOptions?.logger ?? createDefaultLogger();
    this.clientSession = resolveClientSession(this.logger, internalClientOptions?.instanceIdStorage);
    this.timeout = clientOptions?.connection?.timeout ?? 3_000;
    const urlFactory: UrlFactory = internalClientOptions?.urlFactory ?? defaultUrlFactory;
    this.connectionPlan = planConnection(clientSdkKey, clientOptions?.connection, urlFactory);
    this.telemetryClient = this.buildTelemetryClient(liveTelemetryClient, clientOptions);
    this.transport =
      internalClientOptions?.transport ?? this.buildTransport(sdkOptions, clientOptions, urlFactory, internalClientOptions);

    this.transport.on("configSetReceived", (configSet: ConfigSet) => {
      this.hasReceivedConfigSet = true;
      this.readyResolve?.();
      const removedKeys = this.findKeysRemovedBy(configSet);
      if (!this.configSet || configSet.kind == "full") {
        this.configSet = configSet;
      } else {
        this.configSet.configs = {
          ...this.configSet.configs,
          ...configSet.configs,
        };
      }
      const keys = Object.keys(configSet.configs);
      this.emit("configsUpdated", { keys, removedKeys });
      this.updateWatchers([...keys, ...removedKeys]);
      this.logger.debug("[ConfigDirectorClient] ConfigSet updated from server:", { keys, removedKeys });
    });

    this.transport.on("connectionError", (error: Error) => {
      this.initializing = false;
      this.logger.error(
        "[ConfigDirectorClient] The connection encountered an unrecoverable error and will not be retried. Configs will no longer receive updates.",
        error,
      );
      this.emit("connectionError", { error });
    });

    this.registerHandler("clientReady", clientOptions?.hooks?.clientReady);
    this.registerHandler("configEvaluated", clientOptions?.hooks?.configEvaluated);
    this.registerHandler("configsUpdated", clientOptions?.hooks?.configsUpdated);
    this.registerHandler("contextUpdated", clientOptions?.hooks?.contextUpdated);
    this.registerHandler("connectionError", clientOptions?.hooks?.connectionError);
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

  private pollingIntervalFor(mode: LiveConnectionMode, configuredSeconds: number | undefined): number | undefined {
    if (mode !== "polling") {
      return undefined;
    }
    const resolved = resolvePollingInterval(configuredSeconds, {
      defaultSeconds: CLIENT_DEFAULT_POLLING_INTERVAL_SECONDS,
      minimumSeconds: CLIENT_MIN_POLLING_INTERVAL_SECONDS,
    });
    if (resolved.warning) {
      this.logger.warn(`[ConfigDirectorClient] ${resolved.warning}`);
    }
    return resolved.seconds;
  }

  private buildTelemetryClient(
    liveTelemetryClient: LiveTelemetryClientFactory,
    clientOptions: ConfigDirectorClientOptions | undefined,
  ): TelemetryClient {
    const plan = this.connectionPlan;
    switch (plan.kind) {
      case "stay-offline":
        return discardingTelemetryClient;
      case "connect":
        return liveTelemetryClient({
          clientSdkKey: plan.clientSdkKey,
          baseUrl: plan.baseUrl,
          logger: this.logger,
          metadata: clientOptions?.metadata,
        });
    }
  }

  private buildTransport(
    sdkOptions: IdentifyingSdkOptions,
    clientOptions: ConfigDirectorClientOptions | undefined,
    urlFactory: UrlFactory,
    internalClientOptions: InternalClientOptions | undefined,
  ): Transport {
    const plan = this.connectionPlan;
    switch (plan.kind) {
      case "stay-offline":
        return new OfflineTransport(plan.source);
      case "connect": {
        const transportConstructor = this.getTransportConstructor(plan.mode);
        return new transportConstructor({
          clientSession: this.clientSession,
          clientSdkKey: plan.clientSdkKey,
          baseUrl: plan.baseUrl,
          resolveUrl: urlFactory,
          metaContext: {
            ...clientOptions?.metadata,
            sdkName: sdkOptions.sdkName,
            sdkVersion: sdkOptions.sdkVersion,
            userAgent: readUserAgent(),
            host: readHost(),
          },
          logger: this.logger,
          fetch: internalClientOptions?.fetch,
          connectionRetryDelay:
            internalClientOptions?.connectionRetryDelay ??
            ((attempt: number) => {
              const seconds = Math.pow(2, Math.min(attempt, MAX_EXPONENTIAL_DELAY));
              return seconds * 1_000;
            }),
          pollingInterval: this.pollingIntervalFor(plan.mode, clientOptions?.connection?.pollingInterval),
        });
      }
    }
  }

  private getTransportConstructor(mode: LiveConnectionMode) {
    switch (mode) {
      case "polling":
        return PollingTransport;
      case "streaming":
        return StreamingTransport;
    }
  }

  public async initialize(context?: ConfigDirectorContext) {
    if (!this.hasReceivedConfigSet) {
      this.initializing = true;
    }
    await this.submitContext(context, "initialization");
  }

  public async updateContext(context: ConfigDirectorContext) {
    switch (this.connectionPlan.kind) {
      case "connect":
        await this.submitContext(context, "context update");
        return;
      case "stay-offline":
        this.storeContext(this.admittedContextFor(context, "context update"));
        return;
    }
  }

  private storeContext(context: ConfigDirectorContext | undefined) {
    this.currentContext = context;
    this.emit("contextUpdated", { context });
  }

  private async submitContext(context: ConfigDirectorContext | undefined, submission: ContextSubmission) {
    await this.connectToTransport(this.admittedContextFor(context, submission), submission);
  }

  private admittedContextFor(
    suppliedContext: ConfigDirectorContext | undefined,
    submission: ContextSubmission,
  ): ConfigDirectorContext | undefined {
    const admission = admitContext(suppliedContext);
    switch (admission.outcome) {
      case "admitted":
        return admission.context;
      case "ignored":
        this.logger.error(
          `[ConfigDirectorClient] Ignored the context supplied for ${submission} because its kind '${admission.kindSample}' is invalid; continuing as if no context was supplied. A context kind has 1 to 64 characters, using only lowercase letters, digits, '-' and '_'.`,
        );
        this.telemetryClient.recordInvalidContext(admission.kindSample);
        return undefined;
    }
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
      await this.transport.connect(context ?? {}, this.timeout, caller);
      this.currentContext = context;
      this.telemetryClient
        .updateContext(context)
        .catch((error) =>
          this.logger.warn("[ConfigDirectorClient] Telemetry could not update the context: ", error),
        );
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
        this.logger.warn(
          `[ConfigDirectorClient] Timed out waiting for ${caller} after ${this.timeout}ms. ${this.timeoutWarningDetails()}`,
        );
      }
    } catch (error) {
      if (error instanceof ConfigDirectorInitializationError) {
        this.initializing = false;
        throw error;
      }
      this.logger.error(`[ConfigDirectorClient] An error occurred during ${caller}: `, error);
    }
  }

  private timeoutWarningDetails(): string {
    switch (this.connectionPlan.kind) {
      case "connect":
        return "The client will continue to retry since there were no fatal errors detected. Configs will return the default value until the connection succeeds.";
      case "stay-offline":
        return "The offline values were not delivered, so configs return the default value.";
    }
  }

  private findKeysRemovedBy(configSet: ConfigSet): string[] {
    if (!this.configSet || configSet.kind != "full") {
      return [];
    }
    return Object.keys(this.configSet.configs).filter((key) => !Object.prototype.hasOwnProperty.call(configSet.configs, key));
  }

  private updateWatchers(configKeys: string[]) {
    configKeys.forEach((configKey) => this.updateWatchersForConfig(configKey));
  }

  private updateWatchersForConfig(configKey: string) {
    const configState = this.configSet?.configs[configKey];
    this.handlersMap.get(configKey)?.forEach((h) => {
      const value = this.getValueFromConfigState(configKey, configState, h.defaultValue);
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
    switch (this.connectionPlan.kind) {
      case "stay-offline":
        return;
      case "connect":
        this.logger.debug("[ConfigDirectorClient] pauseNetwork() called, pausing transport connection");
        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = undefined;
        this.transport.close();
        this.ready = false;
        return;
    }
  }

  public async resumeNetwork(): Promise<void> {
    switch (this.connectionPlan.kind) {
      case "stay-offline":
        return;
      case "connect":
        await this.connectToTransport(this.currentContext, "network resume");
        return;
    }
  }

  public async close() {
    this.logger.debug("[ConfigDirectorClient] close() has been called, closing connection to server");
    clearTimeout(this.timeoutTimer);
    this.readyResolve?.(true);
    this.telemetryClient
      .close()
      .catch((error) => this.logger.warn("[ConfigDirectorClient] Telemetry could not close: ", error));
    this.transport.close();
    this.ready = false;
    this.initializing = false;
  }

  public dispose() {
    this.clear();
    this.close();
  }
}
