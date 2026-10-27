import type {
  EvaluationContext,
  JsonValue,
  Paradigm,
  Provider,
  ProviderMetadata,
  ResolutionDetails,
} from "@openfeature/server-sdk";
import { OpenFeatureEventEmitter, ProviderEvents } from "@openfeature/server-sdk";
import type { ConfigDirectorContext, ConfigValueType } from "@shared/types";
import type { ConfigDirectorClient, ConfigDirectorClientOptions, OfflineClientOptions } from "@js-server-sdk/index";
import { DefaultConfigDirectorClient } from "@js-server-sdk/DefaultConfigDirectorClient";

const SDK_IDENTITY = { sdkName: "js-openfeature-server-provider", sdkVersion: "__VERSION__" };

export class ConfigDirectorProvider implements Provider {
  private readonly client: ConfigDirectorClient;
  private readonly readyHandler: () => void;

  readonly metadata: ProviderMetadata = {
    name: "ConfigDirectorProvider",
  };
  readonly runsOn: Paradigm = "server";
  readonly events = new OpenFeatureEventEmitter();

  /**
   * Creates a provider connected to ConfigDirector with the given server SDK key.
   */
  public constructor(serverSdkKey: string, clientOptions?: ConfigDirectorClientOptions);
  /**
   * Creates a provider in `offline` mode, which needs no server SDK key: it never connects to
   * ConfigDirector and serves `connection.file` or `connection.values` to every evaluation.
   */
  public constructor(clientOptions: OfflineClientOptions);
  public constructor(
    serverSdkKeyOrOptions: string | OfflineClientOptions,
    clientOptions?: ConfigDirectorClientOptions,
  ) {
    this.client = DefaultConfigDirectorClient.from(serverSdkKeyOrOptions, SDK_IDENTITY, clientOptions);
    this.readyHandler = () => {
      this.events.emit(ProviderEvents.Ready);
    };
    this.client.on("configsUpdated", ({ keys, removedKeys }) => {
      this.events.emit(ProviderEvents.ConfigurationChanged, { flagsChanged: [...keys, ...removedKeys] });
    });
  }

  async initialize() {
    await this.client.initialize();
    this.client.off("clientReady", this.readyHandler);
    this.client.on("clientReady", this.readyHandler);
  }

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<boolean>> {
    return Promise.resolve(this.evaluate(flagKey, defaultValue, context));
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<string>> {
    return Promise.resolve(this.evaluate(flagKey, defaultValue, context));
  }

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<number>> {
    return Promise.resolve(this.evaluate(flagKey, defaultValue, context));
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<T>> {
    return Promise.resolve(
      this.evaluate(flagKey, defaultValue as ConfigValueType, context) as ResolutionDetails<T>,
    );
  }

  onClose?(): Promise<void> {
    this.client.dispose();
    return Promise.resolve();
  }

  private evaluate<T extends ConfigValueType>(
    configKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): ResolutionDetails<T> {
    const value = this.client.getValue(configKey, defaultValue, this.mapContext(context));
    return {
      value,
    };
  }

  private mapContext(openFeatureContext: EvaluationContext): ConfigDirectorContext | undefined {
    if (!openFeatureContext) {
      return undefined;
    }

    const id = (openFeatureContext.targetingKey ?? openFeatureContext["id"])?.toString();
    const kind = openFeatureContext["kind"] as string | undefined;
    const name = openFeatureContext["name"]?.toString();
    const traits = (openFeatureContext?.["traits"] as Record<string, unknown>) || {};
    const hasTraits = typeof traits === "object" && Object.keys(traits).length > 0;
    const anonymousProp = openFeatureContext["anonymous"];

    return {
      id,
      kind,
      name,
      traits: hasTraits ? traits : undefined,
      anonymous: typeof anonymousProp === "boolean" ? anonymousProp : undefined,
    };
  }
}
