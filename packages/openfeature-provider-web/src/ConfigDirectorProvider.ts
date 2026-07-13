import type {
  AnyProviderEvent,
  ClientProviderStatus,
  EvaluationContext,
  Hook,
  JsonValue,
  Paradigm,
  Provider,
  ProviderEventEmitter,
  ProviderMetadata,
  ResolutionDetails,
} from "@openfeature/web-sdk";
import type {
  ConfigDirectorClient,
  ConfigDirectorClientOptions,
  ConfigDirectorContext,
  ConfigValueType,
} from "@js-client-core/index";
import { createBrowserClient } from "@js-browser-client/index";

export class ConfigDirectorProvider implements Provider {
  private readonly client: ConfigDirectorClient;

  readonly metadata: ProviderMetadata = {
    name: ConfigDirectorProvider.name,
  };
  readonly runsOn?: Paradigm = "client";
  hooks?: Hook<Record<string, unknown>>[] | undefined;
  status?: ClientProviderStatus | undefined;
  events?: ProviderEventEmitter<AnyProviderEvent, Record<string, unknown>> | undefined;

  public constructor(clientSdkKey: string, clientOptions?: ConfigDirectorClientOptions) {
    this.client = createBrowserClient(
      clientSdkKey,
      {
        sdkName: "js-openfeature-web-provider",
        sdkVersion: "__VERSION__",
      },
      clientOptions,
    );
  }

  async initialize(context: EvaluationContext) {
    await this.client.initialize(this.mapContext(context));
  }

  async onContextChange?(_oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void> {
    await this.client.updateContext(this.mapContext(newContext));
  }

  resolveBooleanEvaluation(flagKey: string, defaultValue: boolean): ResolutionDetails<boolean> {
    return this.evaluate(flagKey, defaultValue);
  }

  resolveStringEvaluation(flagKey: string, defaultValue: string): ResolutionDetails<string> {
    return this.evaluate(flagKey, defaultValue);
  }

  resolveNumberEvaluation(flagKey: string, defaultValue: number): ResolutionDetails<number> {
    return this.evaluate(flagKey, defaultValue);
  }

  resolveObjectEvaluation<T extends JsonValue>(flagKey: string, defaultValue: T): ResolutionDetails<T> {
    return this.evaluate(flagKey, defaultValue as ConfigValueType) as ResolutionDetails<T>;
  }

  onClose?(): Promise<void> {
    this.client.dispose();
    return Promise.resolve();
  }

  private evaluate<T extends ConfigValueType>(configKey: string, defaultValue: T): ResolutionDetails<T> {
    const value = this.client.getValue(configKey, defaultValue);
    return {
      value,
    };
  }

  private mapContext(openFeatureContext: EvaluationContext): ConfigDirectorContext {
    if (!openFeatureContext) {
      return {};
    }

    const id = (openFeatureContext.targetingKey ?? openFeatureContext["id"])?.toString();
    const name = openFeatureContext["name"]?.toString();
    const traits = (openFeatureContext?.["traits"] as Record<string, unknown>) || {};
    const hasTraits = typeof traits === "object" && Object.keys(traits).length > 0;
    const anonymousProp = openFeatureContext["anonymous"];

    return {
      id,
      name,
      traits: hasTraits ? traits : undefined,
      anonymous: typeof anonymousProp === "boolean" ? anonymousProp : undefined,
    };
  }
}
