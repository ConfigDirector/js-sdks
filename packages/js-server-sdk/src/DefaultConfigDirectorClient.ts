import { StreamingTransport } from "./StreamingTransport";
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
} from "./types";
import { createDefaultLogger } from "./logger";
import { ConfigDirectorValidationError } from "@shared/errors";
import EventEmitter from "node:events";
import type { ConfigDirectorMetaContext } from "@shared/types";
import { ServerTelemetryEventCollector } from "./telemetry";

const defaultBaseUrl = new URL("https://server-sdk-api.configdirector.com");
const DEFAULT_FLUSH_INTERVAL = 30_000;
const DEFAULT_EVENT_QUEUE_LIMIT = 5_000;

type WatchHandlerWithOptions<T extends ConfigValueType> = {
  handler: WatchHandler<T>;
  defaultValue: T;
  requestedType: string;
  context?: ConfigDirectorContext;
};

export class DefaultConfigDirectorClient implements ConfigDirectorClient {
  private logger: ConfigDirectorLogger;
  private usageEventCollector: ServerTelemetryEventCollector;
  private configSet: ConfigBundle | undefined;
  private handlersMap: Map<string, WatchHandlerWithOptions<any>[]> = new Map();
  private transport: Transport;
  private eventEmitter = new EventEmitter();
  private timeout: number;
  private ready = false;
  private readyPromise: Promise<void> | undefined;
  private readyResolve: (() => void) | undefined;
  private streaming: boolean;
  private configEvaluator: ConfigEvaluator;
  private metaContext: ConfigDirectorMetaContext;

  constructor(
    serverSdkKey: string,
    sdkOptions: IdentifyingSdkOptions,
    clientOptions?: ConfigDirectorClientOptions,
  ) {
    this.logger = clientOptions?.logger ?? createDefaultLogger();
    this.timeout = clientOptions?.connection?.timeout ?? 3_000;
    this.metaContext = clientOptions?.metadata ?? {};
    this.configEvaluator = new ConfigEvaluator(this.logger);
    const baseUrl = this.parseUrl(clientOptions?.connection?.url) ?? defaultBaseUrl;
    this.streaming = clientOptions?.connection?.streaming === false ? false : true;
    const transportConstructor = StreamingTransport;
    const queueLimit = clientOptions?.telemetry?.eventQueueLimit ?? DEFAULT_EVENT_QUEUE_LIMIT;
    this.usageEventCollector = new ServerTelemetryEventCollector({
      sdkKey: serverSdkKey,
      logger: this.logger,
      baseUrl,
      flushIntervalDelay: clientOptions?.telemetry?.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
      evaluationQueueLimit: Math.ceil(queueLimit * 0.7),
      contextLimit: Math.floor(queueLimit * 0.3),
    });
    this.transport = new transportConstructor({
      serverSdkKey,
      baseUrl,
      metaContext: {
        ...clientOptions?.metadata,
        sdkName: sdkOptions.sdkName,
        sdkVersion: sdkOptions.sdkVersion,
      },
      logger: this.logger,
    });

    this.transport.on("configBundleReceived", (configBundle: ConfigBundle) => {
      this.readyResolve?.();
      const configKeys = Object.keys(configBundle.configs);
      if (!this.configSet || configBundle.kind == "full") {
        this.configSet = configBundle;
        this.eventEmitter.emit("configsUpdated", { keys: configKeys });
        this.updateWatchers(configBundle.configs);
      } else {
        this.configSet.configs = {
          ...this.configSet.configs,
          ...configBundle.configs,
        };
        this.eventEmitter.emit("configsUpdated", { keys: configKeys });
        this.updateWatchers(configBundle.configs);
      }
      this.logger.debug(
        `[ConfigDirectorClient] ConfigSet updated from server with ${configKeys.length} key(s)`,
        { keys: configKeys },
      );
    });
  }

  public async initialize() {
    try {
      this.ready = false;
      this.readyPromise = new Promise<void>((resolve) => {
        this.readyResolve = resolve;
      }).then(() => {
        this.ready = true;
        this.eventEmitter.emit("clientReady");
        this.logger.debug("[ConfigDirectorClient] Received initial payload from the server, client is ready");
      });
      const startTime = new Date().getTime();
      await this.transport.connect(this.timeout);
      const elapsedTime = new Date().getTime() - startTime;
      const remainingTimeout = this.timeout - elapsedTime;
      if (remainingTimeout > 0) {
        await Promise.race([
          this.readyPromise,
          new Promise<void>((resolve) => {
            setTimeout(() => resolve(), remainingTimeout);
          }),
        ]);
      }
      if (!this.ready) {
        const warningDetails = this.streaming
          ? "The client will continue to retry since there were no fatal errors detected. Configs will return the default value until the connection succeeds."
          : "Since the client was configured without streaming, configs may not update and always return the default value.";
        this.logger.warn(
          `[ConfigDirectorClient] Timed out waiting for initialization after ${this.timeout}ms. ${warningDetails}`,
        );
      }
    } catch (error) {
      this.logger.error("[ConfigDirectorClient] An error occurred during initialization: ", error);
    }
  }

  private updateWatchers(configsMap: Record<string, ConfigDefinition>) {
    Object.values(configsMap).forEach((v) => this.updateWatchersForConfig(v as ConfigDefinition));
  }

  private updateWatchersForConfig(configDefinition: ConfigDefinition) {
    this.handlersMap.get(configDefinition.key)?.forEach((h) => {
      const value = this.getValueFromConfigDefinition(
        configDefinition.key,
        configDefinition,
        h.defaultValue,
        h.context,
      );
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
    this.validateDefaultValue(defaultValue);

    const configDefinition = this.configSet?.configs[configKey];
    return this.getValueFromConfigDefinition(configKey, configDefinition, defaultValue, context);
  }

  private getValueFromConfigDefinition<T extends ConfigValueType>(
    configKey: string,
    configDefinition: ConfigDefinition | undefined,
    defaultValue: T,
    context?: ConfigDirectorContext,
  ): T {
    if (configDefinition) {
      const configState = this.configEvaluator.evaluate(configDefinition, {
        context,
        metadata: this.metaContext,
      });
      const parseResult = parseConfigValue<T>(configState, defaultValue);
      this.usageEventCollector.evaluatedConfig({
        context,
        evaluation: {
          key: configKey,
          defaultValue: defaultValue,
          requestedType: parseResult.requestedType,
          evaluatedValue: parseResult.parsedValue,
          usedDefault: parseResult.usedDefault,
          evaluationReason: parseResult.reason,
        },
      });
      this.logger.debug(`[ConfigDirectorClient] Evaluated '${configKey}' to '${parseResult.parsedValue}'`);
      return parseResult.parsedValue;
    } else {
      this.logger.debug(
        `[ConfigDirectorClient] No config state found for '${configKey}', returning default value '${defaultValue}'`,
      );
      this.usageEventCollector.evaluatedConfig({
        context,
        evaluation: {
          key: configKey,
          defaultValue: defaultValue,
          requestedType: getRequestedType(defaultValue),
          evaluatedValue: defaultValue,
          usedDefault: true,
          evaluationReason: "config-state-missing",
        },
      });
      return defaultValue;
    }
  }

  private parseUrl(url: string | undefined): URL | undefined {
    if (!url) {
      return;
    }

    try {
      return new URL(url);
    } catch (error) {
      throw new ConfigDirectorValidationError(`Invalid base URL '${url}'. Parsing failed: ${error}`);
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

  public closeConnection() {
    this.logger.debug(
      "[ConfigDirectorClient] closeConnection() has been called, closing connection to server",
    );
    this.transport.close();
    this.ready = false;
  }

  public dispose() {
    this.removeAllObservers();
    this.closeConnection();
  }
}
