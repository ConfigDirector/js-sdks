import { StreamingTransport } from "./StreamingTransport";
import { PollingTransport } from "./PollingTransport";
import { OfflineTransport } from "./OfflineTransport";
import { planConnection, type ConnectionPlan, type LiveConnectionMode } from "./connection-plan";
import { ConfigEvaluator } from "@config-evaluator/ConfigEvaluator";
import { getRequestedType, parseConfigValue } from "@shared/value-parser";
import type {
  ConfigDirectorContext,
  ConfigDirectorClientOptions,
  ConfigDirectorClient,
  ClientEvents,
  WatchHandler,
  ConfigValueType,
  ConfigDirectorLogger,
  Transport,
  IdentifyingSdkOptions,
  ConfigBundle,
  ConfigDefinition,
  ConfigState,
  ConfigEvaluation,
  HookHandler,
  InternalClientOptions,
  OfflineClientOptions,
} from "./types";
import { createDefaultLogger } from "./logger";
import { ConfigDirectorInitializationError, ConfigDirectorValidationError } from "@shared/errors";
import EventEmitter from "node:events";
import type { ConfigDirectorMetaContext, EvaluationReason } from "@shared/types";
import { defaultUrlFactory } from "@shared/url";
import {
  SERVER_DEFAULT_POLLING_INTERVAL_SECONDS,
  SERVER_MIN_POLLING_INTERVAL_SECONDS,
} from "@shared/constants";
import { resolvePollingInterval } from "@shared/transport/pollingInterval";
import { admitContext } from "@shared/context-kind";
import {
  DISTINCT_KIND_SAMPLE_LIMIT,
  type InvalidContextRecording,
} from "@shared/telemetry/InvalidContextSubmissions";
import { ServerTelemetryEventCollector, type ServerTelemetryClient } from "./telemetry";
import { discardingTelemetryClient } from "./telemetry/discarding";
import { generateValueId } from "./telemetry/value-id-generator";

const DEFAULT_FLUSH_INTERVAL = 30_000;
const DEFAULT_EVENT_QUEUE_LIMIT = 5_000;

const liveTimeoutWarningDetails: { [M in LiveConnectionMode]: string } = {
  streaming:
    "The client will continue to retry since there were no fatal errors detected. Configs will return the default value until the connection succeeds.",
  polling:
    "Since the client was configured without streaming, configs may not update and always return the default value.",
};

type WatchHandlerWithOptions<T extends ConfigValueType> = {
  handler: WatchHandler<T>;
  defaultValue: T;
  requestedType: string;
  context?: ConfigDirectorContext;
};

const logInvalidContext: {
  [R in InvalidContextRecording]: (logger: ConfigDirectorLogger, kindSample: string) => void;
} = {
  "new-kind-sample": (logger, kindSample) =>
    logger.error(
      `[ConfigDirectorClient] Ignored a context with the invalid kind '${kindSample}' and evaluated as if no context was supplied. A context kind has 1 to 64 characters, using only lowercase letters, digits, '-' and '_'.`,
    ),
  "known-kind-sample": () => {},
  "first-beyond-sample-limit": (logger) =>
    logger.error(
      `[ConfigDirectorClient] Ignored a context with another invalid kind and evaluated as if no context was supplied. ${DISTINCT_KIND_SAMPLE_LIMIT} different invalid kinds were logged recently, so further invalid kinds are not logged individually.`,
    ),
  "beyond-sample-limit": () => {},
};

const usesAnySegment = (definition: ConfigDefinition, segmentIds: Set<string>): boolean =>
  (definition.target?.rules ?? []).some(
    (rule) =>
      rule.type === "conditional" &&
      (rule.conditions ?? []).some(
        (condition) => condition.kind === "segment" && segmentIds.has(condition.segmentId),
      ),
  );

export class DefaultConfigDirectorClient implements ConfigDirectorClient {
  private logger: ConfigDirectorLogger;
  private usageEventCollector: ServerTelemetryClient;
  private configSet: ConfigBundle | undefined;
  private handlersMap: Map<string, WatchHandlerWithOptions<any>[]> = new Map();
  private transport: Transport;
  private eventEmitter = new EventEmitter();
  private timeout: number;
  private ready = false;
  private readyPromise: Promise<void> | undefined;
  private readyResolve: ((cancelled: boolean) => void) | undefined;
  private readyTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly connectionPlan: ConnectionPlan;
  private configEvaluator: ConfigEvaluator;
  private metaContext: ConfigDirectorMetaContext;

  public static from(
    serverSdkKeyOrOptions: string | OfflineClientOptions,
    sdkOptions: IdentifyingSdkOptions,
    clientOptions: ConfigDirectorClientOptions | undefined,
  ): DefaultConfigDirectorClient {
    if (typeof serverSdkKeyOrOptions === "object") {
      return new DefaultConfigDirectorClient(undefined, sdkOptions, serverSdkKeyOrOptions);
    }
    return new DefaultConfigDirectorClient(serverSdkKeyOrOptions, sdkOptions, clientOptions);
  }

  constructor(
    serverSdkKey: string | undefined,
    sdkOptions: IdentifyingSdkOptions,
    clientOptions?: ConfigDirectorClientOptions,
    internalClientOptions?: InternalClientOptions,
  ) {
    this.logger = clientOptions?.logger ?? createDefaultLogger();
    this.timeout = clientOptions?.connection?.timeout ?? 3_000;
    this.metaContext = clientOptions?.metadata ?? {};
    this.connectionPlan = planConnection(serverSdkKey, clientOptions?.connection);
    this.configEvaluator = new ConfigEvaluator(this.logger);
    this.usageEventCollector =
      internalClientOptions?.telemetry ?? this.buildTelemetryClient(sdkOptions, clientOptions);
    this.transport = internalClientOptions?.transport ?? this.buildTransport(sdkOptions, clientOptions);

    this.transport.on("configBundleReceived", (configBundle: ConfigBundle) => {
      this.readyResolve?.(false);
      const removedKeys = this.findKeysRemovedBy(configBundle);
      if (!this.configSet || configBundle.kind == "full") {
        this.configSet = configBundle;
      } else {
        this.configSet.configs = {
          ...this.configSet.configs,
          ...configBundle.configs,
        };
        this.configSet.segments = {
          ...this.configSet.segments,
          ...configBundle.segments,
        };
      }
      const keys = this.findKeysUpdatedBy(configBundle);
      this.eventEmitter.emit("configsUpdated", { keys, removedKeys });
      this.updateWatchers([...keys, ...removedKeys]);
      this.logger.debug(
        `[ConfigDirectorClient] ConfigSet updated from server with ${keys.length} key(s) and ${removedKeys.length} removed key(s)`,
        { keys, removedKeys },
      );
    });

    this.transport.on("connectionError", (error: Error) => {
      this.logger.error(
        "[ConfigDirectorClient] The connection encountered an unrecoverable error and will not be retried. Configs will no longer receive updates.",
        error,
      );
      this.eventEmitter.emit("connectionError", { error });
    });

    this.registerHandler("clientReady", clientOptions?.hooks?.clientReady);
    this.registerHandler("configEvaluated", clientOptions?.hooks?.configEvaluated);
    this.registerHandler("configsUpdated", clientOptions?.hooks?.configsUpdated);
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

  public async initialize() {
    try {
      this.ready = false;
      this.readyPromise = new Promise<boolean>((resolve) => {
        this.readyResolve = resolve;
      }).then((cancelled) => {
        if (cancelled) {
          return;
        }
        this.ready = true;
        this.eventEmitter.emit("clientReady");
        this.logger.debug("[ConfigDirectorClient] Received initial payload from the server, client is ready");
      });
      this.usageEventCollector.start();
      const startTime = new Date().getTime();
      await this.transport.connect(this.timeout);
      const elapsedTime = new Date().getTime() - startTime;
      const remainingTimeout = this.timeout - elapsedTime;
      if (remainingTimeout > 0) {
        await Promise.race([
          this.readyPromise,
          new Promise<void>((resolve) => {
            this.readyTimer = setTimeout(() => resolve(), remainingTimeout);
          }),
        ]);
        this.clearReadyTimer();
      }
      if (!this.ready) {
        this.logger.warn(
          `[ConfigDirectorClient] Timed out waiting for initialization after ${this.timeout}ms. ${this.timeoutWarningDetails()}`,
        );
      }
    } catch (error) {
      if (error instanceof ConfigDirectorInitializationError) {
        throw error;
      }
      this.logger.error("[ConfigDirectorClient] An error occurred during initialization: ", error);
    }
  }

  private timeoutWarningDetails(): string {
    switch (this.connectionPlan.kind) {
      case "connect":
        return liveTimeoutWarningDetails[this.connectionPlan.mode];
      case "stay-offline":
        return "The offline values were not delivered, so configs return the default value.";
    }
  }

  private pollingIntervalFor(
    mode: LiveConnectionMode,
    configuredSeconds: number | undefined,
  ): number | undefined {
    if (mode !== "polling") {
      return undefined;
    }
    const resolved = resolvePollingInterval(configuredSeconds, {
      defaultSeconds: SERVER_DEFAULT_POLLING_INTERVAL_SECONDS,
      minimumSeconds: SERVER_MIN_POLLING_INTERVAL_SECONDS,
    });
    if (resolved.warning) {
      this.logger.warn(`[ConfigDirectorClient] ${resolved.warning}`);
    }
    return resolved.seconds;
  }

  private buildTelemetryClient(
    sdkOptions: IdentifyingSdkOptions,
    clientOptions: ConfigDirectorClientOptions | undefined,
  ): ServerTelemetryClient {
    const plan = this.connectionPlan;
    switch (plan.kind) {
      case "stay-offline":
        return discardingTelemetryClient;
      case "connect": {
        const queueLimit = clientOptions?.telemetry?.eventQueueLimit ?? DEFAULT_EVENT_QUEUE_LIMIT;
        return new ServerTelemetryEventCollector({
          sdkKey: plan.serverSdkKey,
          sdkIdentity: sdkOptions,
          metaContext: clientOptions?.metadata ?? {},
          logger: this.logger,
          baseUrl: plan.baseUrl,
          flushIntervalDelay: clientOptions?.telemetry?.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
          evaluationQueueLimit: Math.ceil(queueLimit * 0.7),
          contextLimit: Math.floor(queueLimit * 0.3),
          urlFactory: defaultUrlFactory,
          valueIdGenerator: generateValueId,
        });
      }
    }
  }

  private buildTransport(
    sdkOptions: IdentifyingSdkOptions,
    clientOptions: ConfigDirectorClientOptions | undefined,
  ): Transport {
    const plan = this.connectionPlan;
    switch (plan.kind) {
      case "stay-offline":
        return new OfflineTransport(plan.source);
      case "connect": {
        const transportConstructor = this.getTransportConstructor(plan.mode);
        return new transportConstructor({
          serverSdkKey: plan.serverSdkKey,
          baseUrl: plan.baseUrl,
          metaContext: {
            ...clientOptions?.metadata,
            sdkName: sdkOptions.sdkName,
            sdkVersion: sdkOptions.sdkVersion,
          },
          logger: this.logger,
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

  private findKeysRemovedBy(configBundle: ConfigBundle): string[] {
    if (!this.configSet || configBundle.kind != "full") {
      return [];
    }
    return Object.keys(this.configSet.configs).filter(
      (key) => !Object.prototype.hasOwnProperty.call(configBundle.configs, key),
    );
  }

  private findKeysUpdatedBy(configBundle: ConfigBundle): string[] {
    const carriedSegmentIds = new Set(Object.keys(configBundle.segments ?? {}));
    const keysUsingCarriedSegments = Object.entries(this.configSet?.configs ?? {})
      .filter(([, definition]) => usesAnySegment(definition, carriedSegmentIds))
      .map(([key]) => key);
    return [...new Set([...Object.keys(configBundle.configs), ...keysUsingCarriedSegments])];
  }

  private updateWatchers(configKeys: string[]) {
    configKeys.forEach((configKey) => this.updateWatchersForConfig(configKey));
  }

  private updateWatchersForConfig(configKey: string) {
    const configDefinition = this.configSet?.configs[configKey];
    this.handlersMap.get(configKey)?.forEach((h) => {
      const value = this.evaluationOf(configKey, configDefinition, h.defaultValue, h.context).value;
      h.handler(value);
    });
  }

  public watch<T extends ConfigValueType>(
    configKey: string,
    defaultValue: T,
    callback: WatchHandler<T>,
    context?: ConfigDirectorContext,
  ) {
    this.validateDefaultValue(defaultValue);

    const handlers = this.handlersMap.get(configKey);
    const handlerWithOptions = {
      handler: callback,
      defaultValue,
      requestedType: typeof defaultValue,
      context,
    };
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

  public getValue<T extends ConfigValueType>(
    configKey: string,
    defaultValue: T,
    context?: ConfigDirectorContext,
  ): T {
    return this.evaluate(configKey, defaultValue, context).value;
  }

  public evaluate<T extends ConfigValueType>(
    configKey: string,
    defaultValue: T,
    context?: ConfigDirectorContext,
  ): ConfigEvaluation<T> {
    this.validateDefaultValue(defaultValue);

    const configDefinition = this.configSet?.configs[configKey];
    return this.evaluationOf(configKey, configDefinition, defaultValue, context);
  }

  private evaluationOf<T extends ConfigValueType>(
    configKey: string,
    configDefinition: ConfigDefinition | undefined,
    defaultValue: T,
    suppliedContext?: ConfigDirectorContext,
  ): ConfigEvaluation<T> {
    const context = this.contextToEvaluate(suppliedContext);
    if (configDefinition) {
      const configState = this.configEvaluator.evaluate(
        configDefinition,
        { context, metadata: this.metaContext },
        this.configSet?.segments,
      );
      const parseResult = parseConfigValue<T>(configState, defaultValue);
      this.usageEventCollector.evaluatedConfig({
        context,
        evaluation: {
          key: configKey,
          type: configState.type,
          defaultValue: defaultValue,
          requestedType: parseResult.requestedType,
          evaluatedValue: parseResult.parsedValue,
          evaluatedValueId: parseResult.parsedValueId,
          usedDefault: parseResult.usedDefault,
          evaluationReason: parseResult.reason,
        },
      });
      const evaluation: ConfigEvaluation<T> = {
        key: configKey,
        value: parseResult.parsedValue,
        valueId: parseResult.parsedValueId ?? undefined,
        isDefaultValue: parseResult.usedDefault,
        reason: parseResult.reason,
        context: context,
      };
      this.dispatchEvaluationEvent(evaluation);
      this.logger.debug(`[ConfigDirectorClient] Evaluated '${configKey}' to '${parseResult.parsedValue}'`);
      return evaluation;
    } else {
      this.logger.debug(
        `[ConfigDirectorClient] No config state found for '${configKey}', returning default value '${defaultValue}'`,
      );
      const reason: EvaluationReason = this.isReady ? "config-state-missing" : "client-not-ready";
      this.usageEventCollector.evaluatedConfig({
        context,
        evaluation: {
          key: configKey,
          defaultValue: defaultValue,
          requestedType: getRequestedType(defaultValue),
          evaluatedValue: defaultValue,
          usedDefault: true,
          evaluationReason: reason,
        },
      });
      const evaluation: ConfigEvaluation<T> = {
        key: configKey,
        value: defaultValue,
        isDefaultValue: true,
        reason,
        context: context,
      };
      this.dispatchEvaluationEvent(evaluation);
      return evaluation;
    }
  }

  private contextToEvaluate(
    suppliedContext: ConfigDirectorContext | undefined,
  ): ConfigDirectorContext | undefined {
    const admission = admitContext(suppliedContext);
    switch (admission.outcome) {
      case "admitted":
        return admission.context;
      case "ignored": {
        const recording = this.usageEventCollector.recordInvalidContext(admission.kindSample);
        logInvalidContext[recording](this.logger, admission.kindSample);
        return undefined;
      }
    }
  }

  private dispatchEvaluationEvent(event: ConfigEvaluation) {
    setTimeout(() => this.eventEmitter.emit("configEvaluated", { evaluation: event }), 0);
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

  public on<T extends keyof ClientEvents>(eventName: T, handler: (args: ClientEvents[T]) => void): void {
    this.eventEmitter.on(eventName, handler);
  }

  public off<T extends keyof ClientEvents>(eventName: T, handler?: (args: ClientEvents[T]) => void) {
    if (handler) {
      this.eventEmitter.off(eventName, handler);
    } else {
      this.eventEmitter.removeAllListeners(eventName);
    }
  }

  public removeAllObservers() {
    this.logger.debug("[ConfigDirectorClient] removeAllObservers() has been called, removing all observers");
    this.eventEmitter.removeAllListeners();
    this.handlersMap.clear();
  }

  public unwatchAll() {
    this.handlersMap.clear();
  }

  public getAllConfigs(options?: {
    context?: ConfigDirectorContext;
    configKeys?: string[];
  }): Record<string, ConfigState> {
    const context = this.contextToEvaluate(options?.context);
    if (!this.configSet) return {};

    const entries = Object.entries(this.configSet.configs);
    const filtered = options?.configKeys
      ? entries.filter(([key]) => options.configKeys?.includes(key))
      : entries;

    return Object.fromEntries(
      filtered.map(([key, config]) => [
        key,
        this.configEvaluator.evaluate(
          config,
          { context, metadata: this.metaContext },
          this.configSet?.segments,
        ),
      ]),
    );
  }

  public closeConnection() {
    this.logger.debug(
      "[ConfigDirectorClient] closeConnection() has been called, closing connection to server",
    );
    this.transport.close();
    this.ready = false;
  }

  private clearReadyTimer() {
    clearTimeout(this.readyTimer);
    this.readyTimer = undefined;
  }

  public dispose() {
    this.removeAllObservers();
    this.closeConnection();
    this.readyResolve?.(true);
    this.clearReadyTimer();
    void this.usageEventCollector.close().catch((error) => {
      this.logger.warn("[ConfigDirectorClient] Error flushing telemetry while disposing the client: ", error);
    });
  }
}
