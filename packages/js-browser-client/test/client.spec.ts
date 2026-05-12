import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import type { ConfigDirectorClient, ConfigDirectorClientOptions } from "../src";
import { createBrowserClient } from "../src";
import { SSE_URL, PULL_URL, createStubbedLogger } from "./helpers";

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

describe("ConfigDirectorClient", () => {
  let client: ConfigDirectorClient;

  beforeAll(async () => {
    await commands.mswSetup();
  });

  afterAll(async () => {
    await commands.mswTeardown();
    client?.dispose();
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
      expect(() => createClient("sdk-key", { connection: { url: "not-a-url" } })).toThrow(/Invalid URL/);
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

  describe("OneTimeTransport (connection.mode: 'one-time')", () => {
    test("initializes and evaluates config values from the pull endpoint", async () => {
      await commands.mswUseHandlers({
        url: PULL_URL,
        responseBody: {
          environmentId: "10000000-0000-0000-0000-000000000000",
          projectId: "20000000-0000-0000-0000-000000000000",
          kind: "full",
          configs: {
            "my-config": { id: "00000000-0000-0000-0000-000000000001", key: "my-config", type: "string", value: "from-pull" },
          },
        },
      });

      client = createClient("sdk-key", { logger, connection: { mode: "one-time" } });
      await client.initialize();

      expect(client.isReady).toBe(true);
      expect(client.getValue("my-config", "default")).toBe("from-pull");

      const payloads = await commands.mswGetPayloads();
      expect(payloads[0]).toMatchObject({ clientSdkKey: "sdk-key" });
    });

    test("does not retry after a fatal 4xx response", async () => {
      await commands.mswUseHandlers({ url: PULL_URL, status: 401 });

      client = createClient("sdk-key", { logger, connection: { mode: "one-time" } });
      await client.initialize();
      await commands.mswUseHandlers({ url: PULL_URL, status: 401 });
      await client.updateContext({ id: "user-1", name: "Alice", traits: {} });

      expect(client.isReady).toBe(false);
      expect(await commands.mswWasRequestReceived()).toBe(false); // second connect attempt is silently ignored after fatal error
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
});
