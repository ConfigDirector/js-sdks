import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { createClient } from "../src";
import { SSE_URL, createStubbedLogger } from "./helpers";
import { commands } from "vitest/browser";

const full = (configs: object = {}) => ({
  environmentId: 100,
  projectId: 200,
  kind: "full",
  configs,
});

const delta = (configs: object) => ({
  environmentId: 100,
  projectId: 200,
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
          data: full({ "example-config": { id: 1000, key: "example-config", type: "string", value: "Bye" } }),
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
            "example-config": { id: 1000, key: "example-config", type: "string", value: "Hello" },
          }),
        },
        {
          delay: 10,
          data: delta({
            "example-config": { id: 1000, key: "example-config", type: "string", value: "Bye" },
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
          data: full({ "example-config": { id: 1000, key: "example-config", type: "string", value: "Bye" } }),
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

  test("returns from initialize if the timeout is reached, but eventually connects", async () => {
    await commands.mswUseSseHandler(
      SSE_URL,
      [
        [
          {
            delay: 100,
            data: delta({
              "example-config": { id: 1000, key: "example-config", type: "string", value: "Bye" },
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
});
