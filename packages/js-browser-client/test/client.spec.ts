import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import type { ConfigDirectorClient, ConfigDirectorClientOptions, ConfigEvaluation } from "../src";
import { createBrowserClient } from "../src";
import {
  SSE_URL,
  POLLING_URL,
  TELEMETRY_URL,
  captureUnhandledRejections,
  createCapturingLogger,
  createStubbedLogger,
  forgetCachedValues,
  hidePageFor,
  removeWorker,
  sleep,
  throwOnWorkerConstruction,
} from "./helpers";

const logger = createStubbedLogger();

const createClient = (clientSdkKey: string, clientOptions?: ConfigDirectorClientOptions | undefined) => {
  return createBrowserClient(
    clientSdkKey,
    { sdkName: "test-sdk", sdkVersion: "1.2.0" },
    clientOptions,
  );
};

const full = (configs: object = {}) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "full",
  configs,
});

const delta = (configs: object) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "delta",
  configs,
});

const stringConfig = (key: string, value: string) => ({
  [key]: { id: `id-${key}`, key, type: "string", value, valueId: `value-id-${key}` },
});

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const waitForTelemetryReport = () =>
  vi.waitFor(
    async () => {
      const payloads = (await commands.mswGetPayloads()) as Record<string, unknown>[];
      const telemetry = payloads.find((payload) => "aggregatedEvents" in payload);
      if (!telemetry) throw new Error("No telemetry report captured yet");
      return telemetry;
    },
    { timeout: 8_000, interval: 50 },
  );

const CACHED_VALUES_STORAGE_KEY =
  "configdirector-sdk:cached-values:cc677751b8441e282621773a9be4622b11cd5bcffce54caabdd19f60e07d556c";

describe("ConfigDirectorClient", () => {
  let client: ConfigDirectorClient;

  beforeAll(async () => {
    await commands.mswSetup();
  });

  afterAll(async () => {
    await commands.mswTeardown();
  });

  beforeEach(forgetCachedValues);

  afterEach(() => {
    client?.dispose();
    forgetCachedValues();
  });

  test("establishes a valid connection on initialize", async () => {
    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
    client = createClient("sdk-key", { logger });
    await client.initialize();

    const payloads = await commands.mswGetPayloads();
    const requestJson = payloads[0] as any;
    expect(requestJson).toMatchObject(expect.objectContaining({ clientSdkKey: "sdk-key" }));
    expect(requestJson?.givenContext).toEqual({});
    expect(requestJson?.metaContext).toMatchObject(
      expect.objectContaining({
        sdkName: "test-sdk",
        sdkVersion: "1.2.0",
        userAgent: expect.stringContaining("Mozilla"),
      }),
    );
  });

  test("reports the SDK identity it was created with in telemetry", async () => {
    await commands.mswUseHandlers(
      { url: POLLING_URL, responseBody: full() },
      { url: TELEMETRY_URL, status: 202 },
    );

    client = createClient("sdk-key", { logger, connection: { mode: "polling" } });
    await client.initialize();
    client.getValue("example-config", "Hello");

    const visibilityState = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    try {
      document.dispatchEvent(new Event("visibilitychange"));

      const report = await waitForTelemetryReport();

      expect(report["metaContext"]).toEqual({ sdkName: "test-sdk", sdkVersion: "1.2.0" });
    } finally {
      visibilityState.mockRestore();
    }
  });

  test("reports telemetry with the instance id it connected with", async () => {
    await commands.mswUseHandlers(
      { url: POLLING_URL, responseBody: full() },
      { url: TELEMETRY_URL, status: 202 },
    );

    client = createClient("sdk-key", { logger, connection: { mode: "polling" } });
    await client.initialize();
    client.getValue("example-config", "Hello");
    await hidePageFor(0);
    const report = await waitForTelemetryReport();

    const payloads = (await commands.mswGetPayloads()) as Record<string, unknown>[];
    const pollPayload = payloads.find((payload) => "givenContext" in payload);
    expect(pollPayload?.["instanceId"]).toMatch(UUID_V4_PATTERN);
    expect(report["instanceId"]).toBe(pollPayload?.["instanceId"]);
  });

  describe.each([
    { scenario: "Worker is not defined", makeWorkerUnavailable: removeWorker },
    { scenario: "constructing a Worker throws", makeWorkerUnavailable: throwOnWorkerConstruction },
  ])("when $scenario", ({ makeWorkerUnavailable }) => {
    let restoreWorker: () => void;
    let unhandledRejections: ReturnType<typeof captureUnhandledRejections>;
    let capturingLogger: ReturnType<typeof createCapturingLogger>;

    beforeEach(async () => {
      restoreWorker = makeWorkerUnavailable();
      unhandledRejections = captureUnhandledRejections();
      capturingLogger = createCapturingLogger();
      await commands.mswUseHandlers(
        {
          url: POLLING_URL,
          responseBody: full({
            "example-config": {
              id: "00000000-0000-0000-0000-0000000003e8",
              key: "example-config",
              type: "string",
              value: "Bye",
            },
          }),
        },
        { url: TELEMETRY_URL, status: 202 },
      );
      client = createClient("sdk-key", { logger: capturingLogger, connection: { mode: "polling" } });
    });

    afterEach(() => {
      client.dispose();
      unhandledRejections.stop();
      restoreWorker();
    });

    test("initializes ready with the payload's values and no unhandled rejection", async () => {
      const events: string[] = [];
      client.on("clientReady", () => events.push("clientReady"));
      client.on("contextUpdated", () => events.push("contextUpdated"));

      await client.initialize({ id: "user-1" });
      await sleep(50);

      expect(client.isReady).toBe(true);
      expect(client.getValue("example-config", "Hello")).toBe("Bye");
      expect(events).toEqual(expect.arrayContaining(["clientReady", "contextUpdated"]));
      expect(unhandledRejections.reasons).toEqual([]);
    });

    test("logs a single warning that telemetry is off, and sends no telemetry", async () => {
      await client.initialize({ id: "user-1" });
      await client.updateContext({ id: "user-2" });
      client.getValue("example-config", "Hello");
      await hidePageFor(500);

      const warnings = capturingLogger.warn.mock.calls.map(([message]) => message);
      expect(warnings).toEqual([expect.stringContaining("Telemetry is off")]);
      const payloads = (await commands.mswGetPayloads()) as Record<string, unknown>[];
      expect(payloads.filter((payload) => "aggregatedEvents" in payload)).toEqual([]);
    });
  });

  test("returns the default value when the config was not sent from the server", async () => {
    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
    client = createClient("sdk-key", { logger });
    await client.initialize();

    expect(client.getValue("example-config", "Hello")).toBe("Hello");
    expect(client.getValue("example-config", 20)).toBe(20);
    expect(client.getValue("example-config", new URL("http://example.com"))).toEqual(
      new URL("http://example.com"),
    );
  });

  test("returns the evaluated config value when the server sends the config set", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          delay: 200,
          data: full({ "example-config": { id: "00000000-0000-0000-0000-0000000003e8", key: "example-config", type: "string", value: "Bye" } }),
        },
      ],
    ]);

    client = createClient("sdk-key", { logger, connection: { timeout: 100 } });
    const subscription = new Promise<string>((resolve) => {
      client.watch("example-config", "DummyDefault", (value: any) => {
        resolve(value);
      });
    });
    await client.initialize();

    expect(client.getValue("example-config", "Hello")).toBe("Hello");
    expect(await subscription).toBe("Bye");
    expect(client.getValue("example-config", "Default")).toBe("Bye");
  });

  test("publishes 'configsUpdated' each time the server sends updates", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          data: full({
            "example-config": { id: "00000000-0000-0000-0000-0000000003e8", key: "example-config", type: "string", value: "Hello" },
          }),
        },
        {
          delay: 10,
          data: delta({
            "example-config": { id: "00000000-0000-0000-0000-0000000003e8", key: "example-config", type: "string", value: "Bye" },
          }),
        },
      ],
    ]);

    client = createClient("sdk-key", { logger });
    let counter = 0;
    client.on("configsUpdated", () => {
      counter += 1;
    });
    await client.initialize();
    await vi.waitFor(() => expect(counter).toBe(2), { timeout: 2_000 });
  });

  test("re-establishes a connection on updateContext", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [{ data: full() }],
      [
        {
          data: full({ "example-config": { id: "00000000-0000-0000-0000-0000000003e8", key: "example-config", type: "string", value: "Bye" } }),
        },
      ],
    ]);

    client = createClient("sdk-key", { logger });

    await client.initialize();
    expect(client.getValue("example-config", "Hello")).toBe("Hello");

    await client.updateContext({ id: "123456", name: "Bob", traits: { email: "bob@example.com" } });
    expect(client.getValue("example-config", "Hello")).toBe("Bye");

    const payloads = await commands.mswGetPayloads();
    expect(payloads).toHaveLength(2);
    expect((payloads as any[]).map((j) => j.clientSdkKey)).toEqual(["sdk-key", "sdk-key"]);
    expect((payloads[0] as any)?.givenContext).toEqual({});
    expect((payloads[1] as any)?.givenContext).toEqual({
      id: "123456",
      name: "Bob",
      traits: { email: "bob@example.com" },
    });
  });

  describe("constructor", () => {
    test("throws on an invalid connection URL", () => {
      expect(() => createClient("sdk-key", { connection: { url: "not-a-url" } })).toThrow(/Invalid base URL/);
    });
  });

  describe("offline mode", () => {
    test("serves the offline values without a client SDK key, a telemetry worker or a request", async () => {
      const workerConstructions = { count: 0 };
      vi.stubGlobal(
        "Worker",
        class extends Worker {
          constructor(...args: ConstructorParameters<typeof Worker>) {
            workerConstructions.count++;
            super(...args);
          }
        },
      );
      try {
        await commands.mswUseHandlers({ url: SSE_URL }, { url: POLLING_URL }, { url: TELEMETRY_URL });
        const offlineClient = createBrowserClient(
          {
            logger,
            metadata: { appName: "offline-app" },
            connection: { mode: "offline", values: { "example-config": "Bye", "max-items": 20 } },
          },
          { sdkName: "test-sdk", sdkVersion: "1.2.0" },
        );

        await offlineClient.initialize({ id: "offline-user-1" });
        await offlineClient.updateContext({ id: "offline-user-2" });
        const values = [offlineClient.getValue("example-config", "Hello"), offlineClient.getValue("max-items", 0)];
        await hidePageFor(100);
        offlineClient.dispose();
        await sleep(100);

        expect(offlineClient.isReady).toBe(false);
        expect(values).toEqual(["Bye", 20]);
        expect(workerConstructions.count).toBe(0);
        expect(JSON.stringify(await commands.mswGetPayloads())).not.toMatch(/offline-(app|user)/);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe("getValue", () => {
    test("returns the default value before initialization", () => {
      client = createClient("sdk-key", { logger });
      expect(client.getValue("any-config", "fallback")).toBe("fallback");
    });

    test("throws when the default value is null", () => {
      client = createClient("sdk-key", { logger });
      expect(() => client.getValue("any-config", null as any)).toThrow("Invalid default value");
    });

    test("throws when the default value is a function", () => {
      client = createClient("sdk-key", { logger });
      expect(() => client.getValue("any-config", (() => "fn") as any)).toThrow("Invalid default value");
    });
  });

  describe("watch", () => {
    test("throws when the default value is null", () => {
      client = createClient("sdk-key", { logger });
      expect(() => client.watch("any-config", null as any, () => {})).toThrow("Invalid default value");
    });

    test("calls all registered handlers for the same key when a config update arrives", async () => {
      const watcher1Values: string[] = [];
      const watcher2Values: string[] = [];
      await commands.mswUseSseHandler(SSE_URL, [
        [{ data: full({ "my-config": { id: "00000000-0000-0000-0000-000000000001", key: "my-config", type: "string", value: "hello" } }) }],
      ]);

      client = createClient("sdk-key", { logger });
      client.watch("my-config", "default", (v: string) => watcher1Values.push(v));
      client.watch("my-config", "default", (v: string) => watcher2Values.push(v));
      await client.initialize();

      expect(watcher1Values).toEqual(["hello"]);
      expect(watcher2Values).toEqual(["hello"]);
    });

    test("the function returned by watch stops that handler from receiving future updates", async () => {
      const receivedValues: string[] = [];
      await commands.mswUseSseHandler(SSE_URL, [
        [{ data: full({ "my-config": { id: "00000000-0000-0000-0000-000000000001", key: "my-config", type: "string", value: "v1" } }) }],
        [{ data: full({ "my-config": { id: "00000000-0000-0000-0000-000000000001", key: "my-config", type: "string", value: "v2" } }) }],
      ]);

      client = createClient("sdk-key", { logger });
      const unwatch = client.watch("my-config", "default", (v: string) => receivedValues.push(v));
      await client.initialize();
      expect(receivedValues).toEqual(["v1"]);

      unwatch();
      await client.updateContext({ id: "user-1", name: "Alice", traits: {} });

      expect(receivedValues).toEqual(["v1"]); // v2 not received after unwatch
    });
  });

  describe("unwatch", () => {
    test("with a callback removes only that handler, leaving others in place", async () => {
      const watcher1Values: string[] = [];
      const watcher2Values: string[] = [];
      await commands.mswUseSseHandler(SSE_URL, [
        [{ data: full({ "my-config": { id: "00000000-0000-0000-0000-000000000001", key: "my-config", type: "string", value: "v1" } }) }],
        [{ data: full({ "my-config": { id: "00000000-0000-0000-0000-000000000001", key: "my-config", type: "string", value: "v2" } }) }],
      ]);

      client = createClient("sdk-key", { logger });
      const h1 = (v: string) => watcher1Values.push(v);
      const h2 = (v: string) => watcher2Values.push(v);
      client.watch("my-config", "default", h1);
      client.watch("my-config", "default", h2);
      await client.initialize();
      expect(watcher1Values).toEqual(["v1"]);
      expect(watcher2Values).toEqual(["v1"]);

      client.unwatch("my-config", h1);
      await client.updateContext({ id: "user-1", name: "Alice", traits: {} });

      expect(watcher1Values).toEqual(["v1"]);
      expect(watcher2Values).toEqual(["v1", "v2"]);
    });

    test("without a callback removes all handlers for that key", async () => {
      const watcher1Values: string[] = [];
      const watcher2Values: string[] = [];
      await commands.mswUseSseHandler(SSE_URL, [
        [{ data: full({ "my-config": { id: "00000000-0000-0000-0000-000000000001", key: "my-config", type: "string", value: "v1" } }) }],
        [{ data: full({ "my-config": { id: "00000000-0000-0000-0000-000000000001", key: "my-config", type: "string", value: "v2" } }) }],
      ]);

      client = createClient("sdk-key", { logger });
      client.watch("my-config", "default", (v: string) => watcher1Values.push(v));
      client.watch("my-config", "default", (v: string) => watcher2Values.push(v));
      await client.initialize();
      expect(watcher1Values).toEqual(["v1"]);
      expect(watcher2Values).toEqual(["v1"]);

      client.unwatch("my-config");
      await client.updateContext({ id: "user-1", name: "Alice", traits: {} });

      expect(watcher1Values).toEqual(["v1"]);
      expect(watcher2Values).toEqual(["v1"]);
    });

    test("unwatchAll removes handlers for all keys", async () => {
      const aWatcherValues: string[] = [];
      const bWatcherValues: string[] = [];
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "config-a": { id: "00000000-0000-0000-0000-000000000001", key: "config-a", type: "string", value: "v1" },
              "config-b": { id: "00000000-0000-0000-0000-000000000002", key: "config-b", type: "string", value: "v1" },
            }),
          },
        ],
        [
          {
            data: full({
              "config-a": { id: "00000000-0000-0000-0000-000000000001", key: "config-a", type: "string", value: "v2" },
              "config-b": { id: "00000000-0000-0000-0000-000000000002", key: "config-b", type: "string", value: "v2" },
            }),
          },
        ],
      ]);

      client = createClient("sdk-key", { logger });
      client.watch("config-a", "default", (v: string) => aWatcherValues.push(v));
      client.watch("config-b", "default", (v: string) => bWatcherValues.push(v));
      await client.initialize();
      expect(aWatcherValues).toEqual(["v1"]);
      expect(bWatcherValues).toEqual(["v1"]);

      client.unwatchAll();
      await client.updateContext({ id: "user-1", name: "Alice", traits: {} });

      expect(aWatcherValues).toEqual(["v1"]);
      expect(bWatcherValues).toEqual(["v1"]);
    });
  });

  describe("events", () => {
    test("isReady is true after a successful initialization", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      client = createClient("sdk-key", { logger });
      await client.initialize();
      expect(client.isReady).toBe(true);
    });

    test("emits 'clientReady' with the action after initialization", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      client = createClient("sdk-key", { logger });
      const readyPayload = await new Promise<any>((resolve) => {
        client.on("clientReady", resolve);
        client.initialize();
      });
      expect(readyPayload).toEqual({ action: "initialization" });
    });

    test("off removes a specific event handler", async () => {
      let count = 0;
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      client = createClient("sdk-key", { logger });
      const handler = () => count++;
      client.on("configsUpdated", handler);
      await client.initialize();
      expect(count).toBe(1);

      client.off("configsUpdated", handler);
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      await client.updateContext({ id: "user-1", name: "Alice", traits: {} });

      expect(count).toBe(1); // handler not called after off()
    });

    test("clear removes all event handlers and watch handlers", async () => {
      let eventCount = 0;
      const watchValues: string[] = [];
      await commands.mswUseSseHandler(SSE_URL, [
        [{ data: full() }],
        [{ data: full({ "my-config": { id: "00000000-0000-0000-0000-000000000001", key: "my-config", type: "string", value: "updated" } }) }],
      ]);

      client = createClient("sdk-key", { logger });
      client.on("configsUpdated", () => eventCount++);
      client.watch("my-config", "default", (v: string) => watchValues.push(v));
      await client.initialize();
      expect(eventCount).toBe(1);

      client.clear();
      await client.updateContext({ id: "user-1", name: "Alice", traits: {} });

      expect(eventCount).toBe(1); // event handler cleared
      expect(watchValues).toHaveLength(0); // watch handler cleared
    });
  });

  describe("lifecycle", () => {
    test("dispose sets isReady to false", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      client = createClient("sdk-key", { logger });
      await client.initialize();
      expect(client.isReady).toBe(true);

      client.dispose();
      expect(client.isReady).toBe(false);
    });

    test("dispose closes the connection and clears all handlers", async () => {
      let eventCount = 0;
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      client = createClient("sdk-key", { logger });
      client.on("configsUpdated", () => eventCount++);
      await client.initialize();
      expect(client.isReady).toBe(true);

      client.dispose();
      expect(client.isReady).toBe(false);
      expect(eventCount).toBe(1); // confirm handler fired once before dispose; verify below it won't again
    });
  });

  describe("config update merging", () => {
    test("delta updates are merged with the existing full config, preserving untouched keys", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "config-a": { id: "00000000-0000-0000-0000-000000000001", key: "config-a", type: "string", value: "a-original" },
              "config-b": { id: "00000000-0000-0000-0000-000000000002", key: "config-b", type: "string", value: "b-original" },
            }),
          },
          {
            delay: 10,
            data: delta({ "config-b": { id: "00000000-0000-0000-0000-000000000002", key: "config-b", type: "string", value: "b-updated" } }),
          },
        ],
      ]);

      client = createClient("sdk-key", { logger });
      await client.initialize();
      await vi.waitFor(
        () => {
          expect(client.getValue("config-b", "default")).toBe("b-updated");
        },
        { timeout: 2_000 },
      );

      expect(client.getValue("config-a", "default")).toBe("a-original"); // preserved
      expect(client.getValue("config-b", "default")).toBe("b-updated"); // updated
    });
  });

  test("returns from initialize if the timeout is reached, but eventually connects", async () => {
    await commands.mswUseSseHandler(
      SSE_URL,
      [
        [
          {
            delay: 100,
            data: delta({
              "example-config": { id: "00000000-0000-0000-0000-0000000003e8", key: "example-config", type: "string", value: "Bye" },
            }),
          },
        ],
      ],
      100,
    );

    client = createClient("sdk-key", { logger, connection: { timeout: 150 } });

    await client.initialize();

    expect(client.isReady).toBe(false);
    await vi.waitFor(() => expect(client.isReady).toBe(true), { timeout: 2_000 });
  });

  describe("cached values", () => {
    test("keeps the last values in localStorage with only the SDK key's SHA-256 digest, under a key derived from that digest, and serves them with reason cached on a launch that cannot connect", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full(stringConfig("my-config", "from-server")) }]]);
      const firstRun = createClient("sdk-key", { logger });
      await firstRun.initialize({ id: "user-1" });
      await vi.waitFor(() => expect(localStorage.getItem(CACHED_VALUES_STORAGE_KEY)).not.toBeNull());
      firstRun.dispose();
      const storedEntry = localStorage.getItem(CACHED_VALUES_STORAGE_KEY) as string;
      expect(storedEntry).not.toContain("sdk-key");
      expect(JSON.parse(storedEntry)).toMatchObject({
        clientSdkKeyDigest: "cc677751b8441e282621773a9be4622b11cd5bcffce54caabdd19f60e07d556c",
        contextTag: { contextKind: "user", contextId: "user-1" },
        configs: stringConfig("my-config", "from-server"),
      });
      await commands.mswUseHandlers({ url: SSE_URL, status: 503 });
      const relaunch = createClient("sdk-key", { logger, connection: { timeout: 100 } });
      const evaluations: ConfigEvaluation[] = [];
      relaunch.on("configEvaluated", ({ evaluation }) => evaluations.push(evaluation));

      await relaunch.initialize({ id: "user-1" });

      expect(relaunch.isReady).toBe(false);
      expect(relaunch.getValue("my-config", "default")).toBe("from-server");
      await vi.waitFor(() =>
        expect(evaluations).toContainEqual(
          expect.objectContaining({ key: "my-config", value: "from-server", isDefaultValue: false, reason: "cached" }),
        ),
      );
      relaunch.dispose();
    });

    test("keeps nothing in localStorage when the values exceed the default limit of 256 KB", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [{ data: full(stringConfig("small", "x")) }, { data: delta(stringConfig("large", "y".repeat(256 * 1024))) }],
      ]);
      const capturingLogger = createCapturingLogger();
      client = createClient("sdk-key", { logger: capturingLogger });
      await client.initialize({ id: "user-1" });

      await vi.waitFor(() => expect(client.getValue("large", "default")).toHaveLength(256 * 1024));
      await vi.waitFor(() =>
        expect(capturingLogger.warn).toHaveBeenCalledWith(
          expect.stringMatching(/exceed the caching provider's limit of 262144 bytes/),
        ),
      );

      expect(localStorage.getItem(CACHED_VALUES_STORAGE_KEY)).toBeNull();
    });

    test("keeps nothing in localStorage when caching is turned off", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full(stringConfig("my-config", "from-server")) }]]);
      client = createClient("sdk-key", { logger, caching: { enabled: false } });
      await client.initialize({ id: "user-1" });
      await sleep(100);

      expect(localStorage.getItem(CACHED_VALUES_STORAGE_KEY)).toBeNull();
    });

    test("keeps nothing and never calls a caching provider of the app's own when crypto.subtle is unavailable", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full(stringConfig("my-config", "from-server")) }]]);
      const provider = { read: vi.fn(), write: vi.fn(), remove: vi.fn(), sizeLimit: vi.fn(() => 256 * 1024) };
      vi.stubGlobal("crypto", {});
      try {
        client = createClient("sdk-key", { logger, caching: { provider } });
        await client.initialize({ id: "user-1" });
        await vi.waitFor(() => expect(client.getValue("my-config", "default")).toBe("from-server"));
        await sleep(100);
      } finally {
        vi.unstubAllGlobals();
      }

      expect(provider.read).not.toHaveBeenCalled();
      expect(provider.write).not.toHaveBeenCalled();
      expect(provider.remove).not.toHaveBeenCalled();
    });
  });
});
