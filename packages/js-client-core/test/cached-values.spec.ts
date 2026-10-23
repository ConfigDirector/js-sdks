import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import type {
  CachingProvider,
  ConfigDirectorClient,
  ConfigDirectorClientOptions,
  ConfigEvaluation,
  ConfigSet,
  InternalClientOptions,
  TelemetryClient,
} from "../src";
import { DefaultConfigDirectorClient } from "../src";
import {
  POLL_URL,
  RecordingTransport,
  createCapturingLogger,
  createStubbedLogger,
  deferred,
  sleep,
} from "./helpers";

const logger = createStubbedLogger();
const telemetryClient: TelemetryClient = {
  updateContext: vi.fn(async () => {}),
  evaluatedConfig: vi.fn(),
  recordInvalidContext: vi.fn(),
  close: vi.fn(async () => {}),
};

const createClient = (
  clientSdkKey: string,
  clientOptions: ConfigDirectorClientOptions,
  internalClientOptions: InternalClientOptions,
) =>
  new DefaultConfigDirectorClient(
    () => telemetryClient,
    clientSdkKey,
    { sdkName: "test-sdk", sdkVersion: "1.2.0" },
    { logger, ...clientOptions },
    internalClientOptions,
  );

class RecordingCachingProvider implements CachingProvider {
  public stored: string | undefined;
  public reads = 0;
  public writes: string[] = [];
  public removes = 0;

  constructor(private readonly limit = 256 * 1024) {}

  read(): string | undefined | Promise<string | undefined> {
    this.reads++;
    return this.stored;
  }

  write(value: string) {
    this.writes.push(value);
    this.stored = value;
  }

  remove() {
    this.removes++;
    this.stored = undefined;
  }

  sizeLimit() {
    return this.limit;
  }
}

const full = (configs: object = {}): ConfigSet => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "full",
  configs: configs as ConfigSet["configs"],
});

const delta = (configs: object): ConfigSet => ({ ...full(configs), kind: "delta" });

const stringConfig = (key: string, value: string) => ({
  [key]: { id: `id-${key}`, key, type: "string", value, valueId: `value-id-${key}` },
});

const integerConfig = (key: string, value: number) => ({
  [key]: { id: `id-${key}`, key, type: "integer", value: String(value), valueId: `value-id-${key}` },
});

const storedEntryOf = (provider: RecordingCachingProvider) => JSON.parse(provider.stored as string);

const INSTANCE_ID_STORAGE_KEY = "configdirector-sdk:instance-id";

const throwing = (): never => {
  throw new Error("storage unavailable");
};

const deviceWarningsOf = (capturingLogger: ReturnType<typeof createCapturingLogger>): string[] =>
  capturingLogger.warn.mock.calls.map((call) => call[0] as string).filter((message) => message.includes("the device"));

const evaluationsOf = (client: ConfigDirectorClient) => {
  const evaluations: ConfigEvaluation[] = [];
  client.on("configEvaluated", ({ evaluation }) => evaluations.push(evaluation));
  return evaluations;
};

const eventsOf = (client: ConfigDirectorClient) => {
  const events: unknown[] = [];
  client.on("clientReady", (event) => events.push({ clientReady: event }));
  client.on("cachedValuesLoaded", (event) => events.push({ cachedValuesLoaded: event }));
  client.on("configsUpdated", (event) => events.push({ configsUpdated: event }));
  return events;
};

const receivePayloadOn = async (provider: RecordingCachingProvider, configs: object) => {
  const transport = new RecordingTransport();
  const client = createClient("sdk-key", { caching: { provider } }, { transport });
  await client.initialize({ id: "user-1" });
  transport.deliver(full(configs));
  await vi.waitFor(() => expect(provider.writes).toHaveLength(1));
  client.dispose();
};

const launchWithoutNetwork = (
  provider: RecordingCachingProvider,
  context: { id?: string; kind?: string } | undefined,
  clientOptions: ConfigDirectorClientOptions = {},
) => {
  const transport = new RecordingTransport();
  const client = createClient(
    "sdk-key",
    { caching: { provider }, connection: { timeout: 50 }, ...clientOptions },
    { transport },
  );
  const events = eventsOf(client);
  const evaluations = evaluationsOf(client);
  const initialization = client.initialize(context);
  return { client, transport, events, evaluations, initialization };
};

describe("cached values", () => {
  const clients: ConfigDirectorClient[] = [];
  const track = (client: ConfigDirectorClient) => {
    clients.push(client);
    return client;
  };

  beforeAll(async () => {
    await commands.mswSetup();
  });

  afterAll(async () => {
    await commands.mswTeardown();
  });

  afterEach(() => {
    clients.splice(0).forEach((client) => client.dispose());
    vi.mocked(telemetryClient.evaluatedConfig).mockClear();
  });

  test("serves the values of the last payload with reason cached on a launch that cannot connect, without becoming ready", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "from-server"));
    const transport = new RecordingTransport();
    const client = track(createClient("sdk-key", { caching: { provider }, connection: { timeout: 50 } }, { transport }));
    const events = eventsOf(client);
    const evaluations = evaluationsOf(client);

    const initialization = client.initialize({ id: "user-1" });

    await vi.waitFor(() => expect(client.getValue("my-config", "default")).toBe("from-server"));
    await vi.waitFor(() =>
      expect(evaluations).toContainEqual({
        key: "my-config",
        value: "from-server",
        valueId: "value-id-my-config",
        isDefaultValue: false,
        reason: "cached",
        context: { id: "user-1" },
      }),
    );
    expect(telemetryClient.evaluatedConfig).toHaveBeenCalledWith(
      expect.objectContaining({ key: "my-config", usedDefault: false, evaluationReason: "cached" }),
    );
    expect(client.isReady).toBe(false);
    expect(events).toEqual([
      { cachedValuesLoaded: {} },
      { configsUpdated: { keys: ["my-config"], removedKeys: [] } },
    ]);

    await initialization;

    expect(client.isReady).toBe(false);
    expect(client.getValue("my-config", "default")).toBe("from-server");
  });

  test("replaces cached values with the live payload and keeps the merged map on the device after a delta", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "yesterday"));
    const { client, transport, events, evaluations, initialization } = launchWithoutNetwork(provider, { id: "user-1" });
    track(client);
    await vi.waitFor(() => expect(client.getValue("my-config", "default")).toBe("yesterday"));

    transport.deliver(full({ ...stringConfig("my-config", "today"), ...stringConfig("other", "one") }));
    await initialization;

    expect(client.isReady).toBe(true);
    expect(client.getValue("my-config", "default")).toBe("today");
    await vi.waitFor(() =>
      expect(evaluations).toContainEqual(expect.objectContaining({ value: "today", reason: "found-match" })),
    );
    expect(events).toEqual([
      { cachedValuesLoaded: {} },
      { configsUpdated: { keys: ["my-config"], removedKeys: [] } },
      { configsUpdated: { keys: ["my-config", "other"], removedKeys: [] } },
      { clientReady: { action: "initialization" } },
    ]);

    transport.deliver(delta(stringConfig("other", "two")));

    await vi.waitFor(() => expect(provider.writes).toHaveLength(3));
    expect(storedEntryOf(provider).configs).toEqual({
      ...stringConfig("my-config", "today"),
      ...stringConfig("other", "two"),
    });
  });

  test("writes one entry carrying the format version, the SDK key, the context tag, the environment and project ids and the time of the payload", async () => {
    vi.setSystemTime(1_700_000_000_000);
    const provider = new RecordingCachingProvider();

    await receivePayloadOn(provider, stringConfig("my-config", "from-server"));

    expect(storedEntryOf(provider)).toEqual({
      formatVersion: 1,
      clientSdkKey: "sdk-key",
      contextTag: { contextKind: "user", contextId: "user-1" },
      environmentId: "10000000-0000-0000-0000-000000000000",
      projectId: "20000000-0000-0000-0000-000000000000",
      configs: stringConfig("my-config", "from-server"),
      receivedAt: 1_700_000_000_000,
    });
    vi.useRealTimers();
  });

  test("ignores cached values tagged with another context and replaces them once that context's payload arrives", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "for-user-1"));
    const { client, transport, events, evaluations, initialization } = launchWithoutNetwork(provider, {
      id: "user-2",
    });
    track(client);
    await initialization;

    expect(client.getValue("my-config", "default")).toBe("default");
    await vi.waitFor(() =>
      expect(evaluations).toContainEqual(expect.objectContaining({ value: "default", reason: "client-not-ready" })),
    );
    expect(events).toEqual([]);

    transport.deliver(full(stringConfig("my-config", "for-user-2")));

    await vi.waitFor(() => expect(provider.writes).toHaveLength(2));
    expect(storedEntryOf(provider)).toMatchObject({
      contextTag: { contextKind: "user", contextId: "user-2" },
      configs: stringConfig("my-config", "for-user-2"),
    });
  });

  test("ignores cached values tagged with the same identifier of another context kind", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "for-user-1"));
    const { client, events, initialization } = launchWithoutNetwork(provider, { id: "user-1", kind: "device" });
    track(client);
    await initialization;

    expect(client.getValue("my-config", "default")).toBe("default");
    expect(events).toEqual([]);
  });

  test("serves in-code defaults on a first launch and keeps the first payload", async () => {
    const provider = new RecordingCachingProvider();
    const { client, transport, events, initialization } = launchWithoutNetwork(provider, { id: "user-1" });
    track(client);
    await initialization;

    expect(client.getValue("my-config", "default")).toBe("default");
    expect(client.isReady).toBe(false);
    expect(events).toEqual([]);
    expect(provider.reads).toBe(1);
    expect(provider.writes).toEqual([]);

    transport.deliver(full(stringConfig("my-config", "first")));

    await vi.waitFor(() => expect(provider.writes).toHaveLength(1));
    expect(storedEntryOf(provider).configs).toEqual(stringConfig("my-config", "first"));
  });

  test("notifies watchers with the cached value when it is adopted", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "from-server"));
    const { client } = launchWithoutNetwork(provider, { id: "user-1" });
    track(client);
    const seen: string[] = [];
    client.watch("my-config", "default", (value) => seen.push(value));

    await vi.waitFor(() => expect(seen).toEqual(["from-server"]));
  });

  test("reports client-not-ready for a key absent from the cached values", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "from-server"));
    const { client, evaluations } = launchWithoutNetwork(provider, { id: "user-1" });
    track(client);
    await vi.waitFor(() => expect(client.getValue("my-config", "default")).toBe("from-server"));

    expect(client.getValue("absent", "default")).toBe("default");

    await vi.waitFor(() =>
      expect(evaluations).toContainEqual(
        expect.objectContaining({ key: "absent", value: "default", isDefaultValue: true, reason: "client-not-ready" }),
      ),
    );
  });

  test("reports a type mismatch against a cached value as it does against a live one", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, integerConfig("max-items", 20));
    const { client, evaluations } = launchWithoutNetwork(provider, { id: "user-1" });
    track(client);
    await vi.waitFor(() => expect(client.getValue("max-items", 0)).toBe(20));

    expect(client.getValue("max-items", "default")).toBe("default");

    await vi.waitFor(() =>
      expect(evaluations).toContainEqual(
        expect.objectContaining({ key: "max-items", value: "default", isDefaultValue: true, reason: "type-mismatch" }),
      ),
    );
  });

  test("removes the entry and warns once when the values exceed the provider's size limit", async () => {
    const provider = new RecordingCachingProvider(100);
    const capturingLogger = createCapturingLogger();
    const transport = new RecordingTransport();
    const client = track(createClient("sdk-key", { logger: capturingLogger, caching: { provider } }, { transport }));
    await client.initialize({ id: "user-1" });

    transport.deliver(full(stringConfig("my-config", "x".repeat(100))));
    transport.deliver(delta(stringConfig("other", "y".repeat(100))));

    await vi.waitFor(() => expect(provider.removes).toBe(2));
    expect(provider.writes).toEqual([]);
    expect(client.getValue("my-config", "default")).toBe("x".repeat(100));
    expect(deviceWarningsOf(capturingLogger)).toEqual([
      expect.stringMatching(/exceed the caching provider's limit of 100 bytes/),
    ]);
  });

  test("reads and writes nothing when caching is turned off, even with a provider given", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "from-server"));
    const { client, transport, events, initialization } = launchWithoutNetwork(provider, { id: "user-1" }, {
      caching: { enabled: false, provider },
    });
    track(client);
    await initialization;

    expect(client.getValue("my-config", "default")).toBe("default");
    expect(events).toEqual([]);

    transport.deliver(full(stringConfig("my-config", "live")));
    await vi.waitFor(() => expect(client.isReady).toBe(true));

    expect(provider.reads).toBe(1);
    expect(provider.writes).toHaveLength(1);
  });

  test("keeps values in the platform's store when no provider is given", async () => {
    const platformProvider = new RecordingCachingProvider();
    const platformCachingProvider = vi.fn((clientSdkKey: string) =>
      clientSdkKey === "sdk-key" ? platformProvider : undefined,
    );
    const transport = new RecordingTransport();
    const client = track(createClient("sdk-key", {}, { transport, platformCachingProvider }));
    await client.initialize({ id: "user-1" });

    transport.deliver(full(stringConfig("my-config", "from-server")));

    await vi.waitFor(() => expect(platformProvider.writes).toHaveLength(1));
    expect(platformProvider.reads).toBe(1);
  });

  test("uses the provider given in the options instead of the platform's store", async () => {
    const platformProvider = new RecordingCachingProvider();
    const customProvider = new RecordingCachingProvider();
    const transport = new RecordingTransport();
    const client = track(
      createClient(
        "sdk-key",
        { caching: { provider: customProvider } },
        { transport, platformCachingProvider: () => platformProvider },
      ),
    );
    await client.initialize({ id: "user-1" });

    transport.deliver(full(stringConfig("my-config", "from-server")));

    await vi.waitFor(() => expect(customProvider.writes).toHaveLength(1));
    expect(platformProvider.reads).toBe(0);
    expect(platformProvider.writes).toEqual([]);
  });

  test("runs without a cache when the platform has no store", async () => {
    const transport = new RecordingTransport();
    const client = track(createClient("sdk-key", {}, { transport, platformCachingProvider: () => undefined }));
    await client.initialize({ id: "user-1" });

    transport.deliver(full(stringConfig("my-config", "from-server")));

    expect(client.getValue("my-config", "default")).toBe("from-server");
  });

  test("ignores the caching option in offline mode", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "from-server"));
    const client = track(
      new DefaultConfigDirectorClient(
        () => telemetryClient,
        undefined,
        { sdkName: "test-sdk", sdkVersion: "1.2.0" },
        { logger, caching: { provider }, connection: { mode: "offline", values: { "my-config": "offline" } } },
      ),
    );
    const events = eventsOf(client);
    await client.initialize({ id: "user-1" });

    expect(client.getValue("my-config", "default")).toBe("offline");
    expect(events).toEqual([
      { configsUpdated: { keys: ["my-config"], removedKeys: [] } },
      { clientReady: { action: "initialization" } },
    ]);
    expect(provider.reads).toBe(1);
    expect(provider.writes).toHaveLength(1);
  });

  test("starts without cached values and warns once when the provider fails to read, then keeps the next payload", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "from-server"));
    provider.read = throwing;
    const capturingLogger = createCapturingLogger();
    const { client, transport, events, initialization } = launchWithoutNetwork(provider, { id: "user-1" }, {
      logger: capturingLogger,
    });
    track(client);
    await initialization;

    expect(client.getValue("my-config", "default")).toBe("default");
    expect(events).toEqual([]);
    expect(provider.removes).toBe(0);
    expect(deviceWarningsOf(capturingLogger)).toEqual([
      expect.stringMatching(/Could not read the values kept on the device/),
    ]);

    transport.deliver(full(stringConfig("my-config", "live")));

    await vi.waitFor(() => expect(provider.writes).toHaveLength(2));
    expect(deviceWarningsOf(capturingLogger)).toHaveLength(1);
  });

  test("keeps running and warns once when the provider fails to write", async () => {
    const provider = new RecordingCachingProvider();
    provider.write = throwing;
    const capturingLogger = createCapturingLogger();
    const transport = new RecordingTransport();
    const client = track(createClient("sdk-key", { logger: capturingLogger, caching: { provider } }, { transport }));
    await client.initialize({ id: "user-1" });

    transport.deliver(full(stringConfig("my-config", "one")));
    transport.deliver(delta(stringConfig("my-config", "two")));

    await vi.waitFor(() =>
      expect(deviceWarningsOf(capturingLogger)).toEqual([
        expect.stringMatching(/Could not keep the values on the device/),
      ]),
    );
    await vi.waitFor(() => expect(client.getValue("my-config", "default")).toBe("two"));
    expect(deviceWarningsOf(capturingLogger)).toHaveLength(1);
    expect(client.isReady).toBe(true);
    expect(client.getValue("my-config", "default")).toBe("two");
  });

  test("keeps running and warns when the provider fails to remove an unreadable entry", async () => {
    const provider = new RecordingCachingProvider();
    provider.stored = "{";
    provider.remove = throwing;
    const capturingLogger = createCapturingLogger();
    const { client, transport, initialization } = launchWithoutNetwork(provider, { id: "user-1" }, {
      logger: capturingLogger,
    });
    track(client);
    await initialization;

    expect(client.getValue("my-config", "default")).toBe("default");
    expect(deviceWarningsOf(capturingLogger)).toEqual([
      expect.stringMatching(/The values kept on the device could not be read and were removed/),
      expect.stringMatching(/Could not remove the values kept on the device/),
    ]);

    transport.deliver(full(stringConfig("my-config", "live")));

    await vi.waitFor(() => expect(client.isReady).toBe(true));
    expect(client.getValue("my-config", "default")).toBe("live");
  });

  test("removes an entry whose format version it does not know and serves in-code defaults", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "from-server"));
    provider.stored = JSON.stringify({ ...storedEntryOf(provider), formatVersion: 2 });
    const { client, events, initialization } = launchWithoutNetwork(provider, { id: "user-1" });
    track(client);
    await initialization;

    expect(client.getValue("my-config", "default")).toBe("default");
    expect(events).toEqual([]);
    expect(provider.removes).toBe(1);
    expect(provider.stored).toBeUndefined();
  });

  test("removes an entry written for another SDK key", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "from-server"));
    provider.stored = JSON.stringify({ ...storedEntryOf(provider), clientSdkKey: "other-key" });
    const { client, initialization } = launchWithoutNetwork(provider, { id: "user-1" });
    track(client);
    await initialization;

    expect(client.getValue("my-config", "default")).toBe("default");
    expect(provider.removes).toBe(1);
  });

  test("keeps serving cached values with reason cached through a context update that cannot connect", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "from-server"));
    const { client, evaluations, initialization } = launchWithoutNetwork(provider, { id: "user-1" });
    track(client);
    await initialization;
    await vi.waitFor(() => expect(client.getValue("my-config", "default")).toBe("from-server"));

    await client.updateContext({ id: "user-2" });

    expect(client.getValue("my-config", "default")).toBe("from-server");
    await vi.waitFor(() =>
      expect(evaluations[evaluations.length - 1]).toEqual(
        expect.objectContaining({ value: "from-server", reason: "cached", context: { id: "user-2" } }),
      ),
    );
    expect(client.isReady).toBe(false);
  });

  test("discards a read that completes after the live payload arrived", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "yesterday"));
    const read = deferred<string | undefined>();
    const stored = provider.stored;
    provider.read = () => read.promise;
    const { client, transport, events } = launchWithoutNetwork(provider, { id: "user-1" });
    track(client);
    transport.deliver(full(stringConfig("my-config", "today")));
    await vi.waitFor(() => expect(client.isReady).toBe(true));

    read.resolve(stored);
    await sleep(100);

    expect(client.getValue("my-config", "default")).toBe("today");
    expect(events).toEqual([
      { configsUpdated: { keys: ["my-config"], removedKeys: [] } },
      { clientReady: { action: "initialization" } },
    ]);
  });

  test("adopts cached values of an anonymous context on the same install", async () => {
    const provider = new RecordingCachingProvider();
    const transport = new RecordingTransport();
    const client = createClient("sdk-key", { caching: { provider } }, { transport });
    await client.initialize({ name: "anonymous visitor" });
    transport.deliver(full(stringConfig("my-config", "from-server")));
    await vi.waitFor(() => expect(provider.writes).toHaveLength(1));
    client.dispose();
    const instanceId = JSON.parse(localStorage.getItem(INSTANCE_ID_STORAGE_KEY) as string).id;
    expect(storedEntryOf(provider).contextTag).toEqual({ contextKind: "user", anonymousInstanceId: instanceId });
    const { client: relaunched } = launchWithoutNetwork(provider, { kind: "user" });
    track(relaunched);

    await vi.waitFor(() => expect(relaunched.getValue("my-config", "default")).toBe("from-server"));
  });

  test("ignores cached values of an anonymous context on another install", async () => {
    const provider = new RecordingCachingProvider();
    const transport = new RecordingTransport();
    const client = createClient("sdk-key", { caching: { provider } }, { transport });
    await client.initialize();
    transport.deliver(full(stringConfig("my-config", "from-server")));
    await vi.waitFor(() => expect(provider.writes).toHaveLength(1));
    client.dispose();
    localStorage.removeItem(INSTANCE_ID_STORAGE_KEY);
    const { client: relaunched, events, initialization } = launchWithoutNetwork(provider, undefined);
    track(relaunched);
    await initialization;

    expect(relaunched.getValue("my-config", "default")).toBe("default");
    expect(events).toEqual([]);
  });

  test("leaves the instance id record as it was when values are kept and adopted", async () => {
    const provider = new RecordingCachingProvider();
    await receivePayloadOn(provider, stringConfig("my-config", "from-server"));
    const instanceIdRecord = localStorage.getItem(INSTANCE_ID_STORAGE_KEY);
    const { client, initialization } = launchWithoutNetwork(provider, { id: "user-1" });
    track(client);
    await initialization;
    await vi.waitFor(() => expect(client.getValue("my-config", "default")).toBe("from-server"));

    expect(localStorage.getItem(INSTANCE_ID_STORAGE_KEY)).toBe(instanceIdRecord);
    expect(provider.stored).not.toContain(JSON.parse(instanceIdRecord as string).id);
  });

  test("polls without a watermark on a relaunch, so the first poll returns a full set", async () => {
    await commands.mswUseHandlers({
      url: POLL_URL,
      responseBody: { ...full(stringConfig("my-config", "from-server")), timestamp: "2024-01-01T00:00:00.000Z" },
    });
    const provider = new RecordingCachingProvider();
    const firstRun = createClient("sdk-key", { caching: { provider }, connection: { mode: "polling" } }, {});
    await firstRun.initialize({ id: "user-1" });
    await vi.waitFor(() => expect(provider.writes).toHaveLength(1));
    firstRun.dispose();

    const relaunch = track(
      createClient("sdk-key", { caching: { provider }, connection: { mode: "polling" } }, {}),
    );
    await relaunch.initialize({ id: "user-1" });

    const payloads = (await commands.mswGetPayloads()) as { lastUpdateTimestamp?: string }[];
    expect(payloads).toHaveLength(2);
    expect(payloads[1]).not.toHaveProperty("lastUpdateTimestamp");
  });
});
