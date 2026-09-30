import { DefaultConfigDirectorClient } from "../DefaultConfigDirectorClient";
import { createDefaultLogger } from "../logger";
import type { ConfigDirectorClient, ConfigDirectorContext, ConfigDirectorLogger, IdentifyingSdkOptions } from "../types";
import type { TelemetryClient } from "../telemetry";
import { InMemoryConnection } from "./InMemoryConnection";
import type { TestValue, TestValues } from "./values";

const TEST_CLIENT_SDK_KEY = "test-client";

/**
 * Options for {@link createTestClient}. Every option is optional.
 */
export type TestClientOptions = {
  /**
   * The config values the test client serves once its client connects, keyed by config key. The
   * config type follows from each value: a boolean, an integral number (`integer`), any other
   * number (`float`), a string, or a plain object or array (`json`).
   */
  values?: TestValues;
  /**
   * The connection timeout of the SDK client, in milliseconds. It bounds how long a held
   * `initialize` or `updateContext` waits. Defaults to the SDK's production timeout.
   */
  timeout?: number;
  /**
   * The logger the SDK client uses. Defaults to the SDK's console logger at `warn` level.
   */
  logger?: ConfigDirectorLogger;
};

/**
 * A real ConfigDirector client connected to an in-memory server that the test controls.
 *
 * The client under {@link TestClient.client} is the SDK's production client: value parsing, watchers,
 * events, and readiness behave as they do against ConfigDirector. Only the network connection and
 * telemetry are replaced, so no request is ever made and nothing is left running after the client is
 * disposed.
 */
export interface TestClient {
  /**
   * The SDK client to hand to the code under test. It starts uninitialized, like a production
   * client; `initialize` completes at once with the seeded values unless initialization is held.
   */
  readonly client: ConfigDirectorClient;

  /**
   * Stores `value` under `key` and, when the client is connected, delivers it as an update, so
   * reads, watchers, and `configsUpdated` handlers see it.
   */
  setValue(key: string, value: TestValue): void;

  /**
   * Removes `key` and, when the client is connected, delivers a full update without it, so reads
   * fall back to the in-code default value and watchers of `key` receive that default.
   */
  removeValue(key: string): void;

  /**
   * Replaces every stored value with `values`, disarms any armed hold or failure, and, when the
   * client is connected, delivers the new values as a full update.
   */
  replaceValues(values: TestValues): void;

  /**
   * Makes the next `initialize` wait until {@link completeInitialization} or
   * {@link failInitialization} is called, or until the client's timeout elapses.
   */
  holdInitialization(): void;

  /**
   * Delivers the stored values to a held `initialize`, so it completes with the client ready. When
   * a hold is armed but no `initialize` has started, it disarms the hold instead.
   */
  completeInitialization(): void;

  /**
   * Fails a held `initialize` with an unrecoverable connection error, or arms the next `initialize`
   * to fail. `initialize` completes promptly with the client not ready and `connectionError` fires.
   */
  failInitialization(): void;

  /**
   * Makes the next `updateContext` wait until {@link completeContextUpdate} or
   * {@link failContextUpdate} is called, or until the client's timeout elapses.
   */
  holdContextUpdate(): void;

  /**
   * Delivers the stored values to a held `updateContext`, or disarms an armed hold that no
   * `updateContext` has picked up.
   */
  completeContextUpdate(): void;

  /**
   * Fails a held `updateContext` with an unrecoverable connection error, or arms the next
   * `updateContext` to fail.
   */
  failContextUpdate(): void;

  /**
   * The context of every `initialize` and `updateContext` call, in call order. `initialize` without
   * a context records an empty context. Resumes are not recorded.
   */
  readonly contextUpdates: ConfigDirectorContext[];
}

const noopTelemetryClient: TelemetryClient = {
  updateContext: async () => {},
  evaluatedConfig: () => {},
  close: async () => {},
};

class InMemoryTestClient implements TestClient {
  constructor(
    public readonly client: ConfigDirectorClient,
    private readonly connection: InMemoryConnection,
  ) {}

  public setValue(key: string, value: TestValue) {
    this.connection.setValue(key, value);
  }

  public removeValue(key: string) {
    this.connection.removeValue(key);
  }

  public replaceValues(values: TestValues) {
    this.connection.replaceValues(values);
  }

  public holdInitialization() {
    this.connection.hold("initialize");
  }

  public completeInitialization() {
    this.connection.complete("initialize");
  }

  public failInitialization() {
    this.connection.fail("initialize");
  }

  public holdContextUpdate() {
    this.connection.hold("updateContext");
  }

  public completeContextUpdate() {
    this.connection.complete("updateContext");
  }

  public failContextUpdate() {
    this.connection.fail("updateContext");
  }

  public get contextUpdates(): ConfigDirectorContext[] {
    return this.connection.contextUpdates;
  }
}

export const createTestClient = (sdkOptions: IdentifyingSdkOptions, options?: TestClientOptions): TestClient => {
  const logger = options?.logger ?? createDefaultLogger();
  const connection = new InMemoryConnection(logger, options?.values ?? {});
  const client = new DefaultConfigDirectorClient(
    noopTelemetryClient,
    TEST_CLIENT_SDK_KEY,
    sdkOptions,
    { logger, connection: { timeout: options?.timeout } },
    { transport: connection },
  );
  return new InMemoryTestClient(client, connection);
};
