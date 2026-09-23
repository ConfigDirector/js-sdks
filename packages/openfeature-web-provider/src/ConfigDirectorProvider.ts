import type {
  EvaluationContext,
  JsonValue,
  Paradigm,
  Provider,
  ProviderMetadata,
  ResolutionDetails,
} from "@openfeature/web-sdk";
import { OpenFeatureEventEmitter, ProviderEvents, ProviderNotReadyError } from "@openfeature/web-sdk";
import type {
  ConfigDirectorClient,
  ConfigDirectorClientOptions,
  ConfigDirectorContext,
  ConfigValueType,
} from "@js-client-core/index";
import { createBrowserClient } from "@js-browser-client/index";

export class ConfigDirectorProvider implements Provider {
  private readonly client: ConfigDirectorClient;
  private awaitingRecovery = false;

  readonly metadata: ProviderMetadata = {
    name: ConfigDirectorProvider.name,
  };
  readonly runsOn: Paradigm = "client";
  readonly events = new OpenFeatureEventEmitter();

  public constructor(clientSdkKey: string, clientOptions?: ConfigDirectorClientOptions) {
    this.client = createBrowserClient(
      clientSdkKey,
      {
        sdkName: "js-openfeature-web-provider",
        sdkVersion: "__VERSION__",
      },
      clientOptions,
    );
    this.client.on("clientReady", () => {
      if (!this.awaitingRecovery) {
        return;
      }
      this.awaitingRecovery = false;
      this.events.emit(ProviderEvents.Ready);
    });
    this.client.on("configsUpdated", ({ keys }) => {
      this.events.emit(ProviderEvents.ConfigurationChanged, { flagsChanged: keys });
    });
  }

  async initialize(context: EvaluationContext) {
    this.awaitingRecovery = false;
    await this.client.initialize(this.mapContext(context));
    this.requireReady(
      "ConfigDirector did not become ready during initialization. Flags resolve to their default values " +
        "until the connection succeeds.",
    );
  }

  async onContextChange?(_oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void> {
    this.awaitingRecovery = false;
    this.events.emit(ProviderEvents.Stale, { message: "Context Changed" });
    await this.client.updateContext(this.mapContext(newContext));
    this.requireReady(
      "ConfigDirector did not become ready after the context changed. Flags resolve against the previous " +
        "context until the connection succeeds.",
    );
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

  private requireReady(message: string) {
    if (this.client.isReady) {
      return;
    }
    this.awaitingRecovery = true;
    throw new ProviderNotReadyError(message);
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
