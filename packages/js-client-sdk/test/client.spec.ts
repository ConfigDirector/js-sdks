import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { createClient } from "../src";
import { SSE_URL, POLL_URL, createStubbedLogger } from "./helpers";
import { commands } from "vitest/browser";

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

const logger = createStubbedLogger();

describe("ConfigDirectorClient", () => {
  beforeAll(async () => {
    await commands.mswSetup();
  });
  afterAll(async () => await commands.mswTeardown());

  test("establishes a valid connection on initialize", async () => {
    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
    const client = createClient("sdk-key", { logger });
    await client.initialize();

    const payloads = await commands.mswGetPayloads();
    const requestJson = payloads[0] as any;
    expect(requestJson).toMatchObject(expect.objectContaining({ clientSdkKey: "sdk-key" }));
    expect(requestJson?.givenContext).toEqual({});
    expect(requestJson?.metaContext).toMatchObject(
      expect.objectContaining({
        sdkName: "js-client-sdk",
        sdkVersion: "__VERSION__",
        userAgent: expect.stringContaining("Mozilla"),
      }),
    );
  });

  test("returns the default value when the config was not sent from the server", async () => {
    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
    const client = createClient("sdk-key", { logger });
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
          data: full({
            "example-config": {
              id: "00000000-0000-0000-0000-0000000003e8",
              key: "example-config",
              type: "string",
              value: "Bye",
            },
          }),
        },
      ],
    ]);

    const client = createClient("sdk-key", { logger, connection: { timeout: 100 } });
    const subscription = new Promise<string>((resolve) => {
      client.watch("example-config", "DummyDefault", (value) => {
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
            "example-config": {
              id: "00000000-0000-0000-0000-0000000003e8",
              key: "example-config",
              type: "string",
              value: "Hello",
            },
          }),
        },
        {
          delay: 10,
          data: delta({
            "example-config": {
              id: "00000000-0000-0000-0000-0000000003e8",
              key: "example-config",
              type: "string",
              value: "Bye",
            },
          }),
        },
      ],
    ]);

    const client = createClient("sdk-key", { logger });
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
          data: full({
            "example-config": {
              id: "00000000-0000-0000-0000-0000000003e8",
              key: "example-config",
              type: "string",
              value: "Bye",
            },
          }),
        },
      ],
    ]);

    const client = createClient("sdk-key", { logger });

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

  describe("json configs", () => {
    test("returns the parsed object when the server sends a json config and the default is an object", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "json-config": {
                id: "00000000-0000-0000-0000-000000000001",
                key: "json-config",
                type: "json",
                value: JSON.stringify({ greeting: "hello", count: 3 }),
              },
            }),
          },
        ],
      ]);

      const client = createClient("sdk-key", { logger });
      await client.initialize();

      expect(client.getValue("json-config", { greeting: "default", count: 0 })).toEqual({
        greeting: "hello",
        count: 3,
      });
    });

    test("returns the default object when the json config key is not present in the server response", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

      const client = createClient("sdk-key", { logger });
      await client.initialize();

      expect(client.getValue("json-config", { greeting: "default" })).toEqual({ greeting: "default" });
    });

    test("returns the raw json string when the default value type is string", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "json-config": {
                id: "00000000-0000-0000-0000-000000000001",
                key: "json-config",
                type: "json",
                value: JSON.stringify({ greeting: "hello" }),
              },
            }),
          },
        ],
      ]);

      const client = createClient("sdk-key", { logger });
      await client.initialize();

      expect(client.getValue("json-config", "{}")).toBe(JSON.stringify({ greeting: "hello" }));
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
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
                key: "example-config",
                type: "string",
                value: "Bye",
              },
            }),
          },
        ],
      ],
      100,
    );

    vi.spyOn(logger, "warn");
    const client = createClient("sdk-key", { logger, connection: { timeout: 150 } });

    await client.initialize();

    expect(client.isReady).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Timed out"));
    await vi.waitFor(() => expect(client.isReady).toBe(true), { timeout: 2_000 });
  });

  describe("hooks option", () => {
    test("registers a single clientReady handler", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      const handler = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { clientReady: handler } });

      await client.initialize();

      expect(handler).toHaveBeenCalledOnce();
    });

    test("registers multiple clientReady handlers", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { clientReady: [handler1, handler2] } });

      await client.initialize();

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    test("registers a single configsUpdated handler", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      const handler = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { configsUpdated: handler } });

      await client.initialize();

      expect(handler).toHaveBeenCalledOnce();
    });

    test("registers multiple configsUpdated handlers", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { configsUpdated: [handler1, handler2] } });

      await client.initialize();

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    test("registers a single contextUpdated handler", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      const handler = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { contextUpdated: handler } });

      await client.initialize();

      expect(handler).toHaveBeenCalledOnce();
    });

    test("registers multiple contextUpdated handlers", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { contextUpdated: [handler1, handler2] } });

      await client.initialize();

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    test("registers a single configEvaluated handler", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      const handler = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { configEvaluated: handler } });

      await client.initialize();
      client.getValue("any-config", "default");

      await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    });

    test("registers multiple configEvaluated handlers", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { configEvaluated: [handler1, handler2] } });

      await client.initialize();
      client.getValue("any-config", "default");

      await vi.waitFor(() => {
        expect(handler1).toHaveBeenCalledOnce();
        expect(handler2).toHaveBeenCalledOnce();
      });
    });
  });

  describe("instanceId", () => {
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    test("sends a generated instanceId on the streaming (SSE) connection", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const payloads = await commands.mswGetPayloads();
      expect((payloads[0] as any)?.instanceId).toMatch(UUID_PATTERN);
    });

    test("the instanceId stays the same across reconnects for the same client", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }], [{ data: full() }]]);
      const client = createClient("sdk-key", { logger });
      await client.initialize();
      await client.updateContext({ id: "user-1", name: "Alice", traits: {} });

      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(2);
      expect((payloads[0] as any)?.instanceId).toMatch(UUID_PATTERN);
      expect((payloads[1] as any)?.instanceId).toBe((payloads[0] as any)?.instanceId);
    });

    test("different client instances receive different instanceIds", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }], [{ data: full() }]]);
      const clientA = createClient("sdk-key", { logger });
      await clientA.initialize();
      const clientB = createClient("sdk-key", { logger });
      await clientB.initialize();

      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(2);
      expect((payloads[0] as any)?.instanceId).not.toBe((payloads[1] as any)?.instanceId);
    });

    test("sends a generated instanceId in 'one-time' connection mode", async () => {
      await commands.mswUseHandlers({ url: POLL_URL, responseBody: full() });
      const client = createClient("sdk-key", { logger, connection: { mode: "one-time" } });
      await client.initialize();

      const payloads = await commands.mswGetPayloads();
      expect((payloads[0] as any)?.instanceId).toMatch(UUID_PATTERN);
    });

    test("sends a generated instanceId in 'polling' connection mode and reuses it across polls", async () => {
      await commands.mswUseHandlers({ url: POLL_URL, responseBody: full() });
      const client = createClient("sdk-key", {
        logger,
        connection: { mode: "polling", pollingInterval: 10 },
      });
      await client.initialize();
      await client.updateContext({ id: "user-1", name: "Alice", traits: {} });

      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(2);
      expect((payloads[0] as any)?.instanceId).toMatch(UUID_PATTERN);
      expect((payloads[1] as any)?.instanceId).toBe((payloads[0] as any)?.instanceId);
    });
  });
});
