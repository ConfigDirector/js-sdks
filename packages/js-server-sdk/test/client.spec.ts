import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setupServer } from "msw/node";
import { http } from "msw";
import { createClient } from "../src";
import type { DefaultConfigDirectorClient } from "../src/DefaultConfigDirectorClient";
import { ServerTelemetryEventCollector } from "../src/telemetry";
import { createStubbedLogger, sleep, SSE_URL } from "./helpers";

const buildResponse = (stream: ReadableStream) => {
  return new Response(stream, {
    headers: {
      connection: "keep-alive",
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
};

const message = (data: any) => {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
};

const server = setupServer();
const logger = createStubbedLogger();

describe("ConfigDirectorClient", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  beforeEach(() => server.resetHandlers());
  afterAll(() => server.close());

  test("establishes a valid connection on initialize", async () => {
    let requestJson: any = undefined;
    server.use(
      http.post(SSE_URL, async ({ request }) => {
        requestJson = await request.json();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              message({
                environmentId: "10000000-0000-0000-0000-000000000000",
                projectId: "20000000-0000-0000-0000-000000000000",
                kind: "full",
                configs: {},
              }),
            );
          },
        });

        return buildResponse(stream);
      }),
    );
    const client = createClient("sdk-key", { logger });
    await client.initialize();

    expect(requestJson).toMatchObject(expect.objectContaining({ serverSdkKey: "sdk-key" }));
    expect(requestJson?.metaContext).toMatchObject(
      expect.objectContaining({
        sdkName: "js-server-sdk",
        sdkVersion: "__VERSION__",
      }),
    );
  });

  describe("constructor", () => {
    test.each([null, undefined, "", "   "])(
      "throws when the server SDK key is %p",
      (invalidSdkKey) => {
        expect(() => createClient(invalidSdkKey as any)).toThrow("No server SDK key was provided");
      },
    );

    test.each(["sdk-key", "a", "  sdk-key  "])(
      "does not throw when the server SDK key is %p",
      (validSdkKey) => {
        expect(() => createClient(validSdkKey)).not.toThrow();
      },
    );
  });

  test("returns from initialize if the timeout is reached, but eventually connects", async () => {
    server.use(
      http.post(SSE_URL, async () => {
        await sleep(100);

        const stream = new ReadableStream({
          start(controller) {
            setTimeout(() => {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "delta",
                  configs: {
                    "example-config": {
                      id: "00000000-0000-0000-0000-0000000003e8",
                      key: "example-config",
                      type: "string",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [],
                        defaultValue: "Hello",
                      },
                    },
                  },
                }),
              );
            }, 100);
          },
        });

        return buildResponse(stream);
      }),
    );

    vi.spyOn(logger, "warn");
    const client = createClient("sdk-key", { logger, connection: { timeout: 150 } });

    await client.initialize();

    expect(client.isReady).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Timed out"));
    await sleep(100);
    expect(client.isReady).toBe(true);
  });

  test("publishes 'configsUpdated' each time the server sends updates", async () => {
    server.use(
      http.post(SSE_URL, async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              message({
                environmentId: "10000000-0000-0000-0000-000000000000",
                projectId: "20000000-0000-0000-0000-000000000000",
                kind: "full",
                configs: {
                  "example-config": {
                    id: "00000000-0000-0000-0000-0000000003e8",
                    key: "example-config",
                    type: "string",
                    variations: [],
                    target: {
                      environmentId: "10000000-0000-0000-0000-000000000000",
                      rules: [],
                      defaultValue: "Hello",
                    },
                  },
                },
              }),
            );

            setTimeout(() => {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "delta",
                  configs: {
                    "example-config": {
                      id: "00000000-0000-0000-0000-0000000003e8",
                      key: "example-config",
                      type: "string",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [],
                        defaultValue: "Bye",
                      },
                    },
                  },
                }),
              );
            }, 10);
          },
        });

        return buildResponse(stream);
      }),
    );

    const client = createClient("sdk-key", { logger });
    const subscription = new Promise<number>((resolve) => {
      let counter = 0;
      client.on("configsUpdated", () => {
        counter += 1;
      });
      setTimeout(() => resolve(counter), 100);
    });
    await client.initialize();

    expect(await subscription).toBe(2);
  });

  test("returns the default value when the config was not sent from the server", async () => {
    server.use(
      http.post(SSE_URL, async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              message({
                environmentId: "10000000-0000-0000-0000-000000000000",
                projectId: "20000000-0000-0000-0000-000000000000",
                kind: "full",
                configs: {},
              }),
            );
          },
        });

        return buildResponse(stream);
      }),
    );
    const client = createClient("sdk-key", { logger });
    await client.initialize();

    expect(client.getValue("example-config", "Hello")).toBe("Hello");
    expect(client.getValue("example-config", 20)).toBe(20);
    expect(client.getValue("example-config", new URL("http://example.com"))).toEqual(
      new URL("http://example.com"),
    );
  });

  describe("json configs", () => {
    test("returns the parsed object when the server sends a json config and the default is an object", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {
                    "json-config": {
                      id: "00000000-0000-0000-0000-000000000001",
                      key: "json-config",
                      type: "json",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [],
                        defaultValue: JSON.stringify({ greeting: "hello", count: 3 }),
                      },
                    },
                  },
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      await client.initialize();

      expect(client.getValue("json-config", { greeting: "default", count: 0 })).toEqual({
        greeting: "hello",
        count: 3,
      });
    });

    test("returns the default object when the json config key is not present in the server response", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {},
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      await client.initialize();

      expect(client.getValue("json-config", { greeting: "default" })).toEqual({ greeting: "default" });
    });

    test("returns the raw json string when the default value type is string", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {
                    "json-config": {
                      id: "00000000-0000-0000-0000-000000000001",
                      key: "json-config",
                      type: "json",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [],
                        defaultValue: JSON.stringify({ greeting: "hello" }),
                      },
                    },
                  },
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      await client.initialize();

      expect(client.getValue("json-config", "{}")).toBe(JSON.stringify({ greeting: "hello" }));
    });

    test("returns the rule-matched json value when a targeting rule condition is satisfied", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {
                    "json-config": {
                      id: "00000000-0000-0000-0000-000000000001",
                      key: "json-config",
                      type: "json",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [
                          {
                            id: crypto.randomUUID(),
                            order: 0,
                            type: "conditional",
                            target: "value",
                            percentages: null,
                            value: JSON.stringify({ theme: "dark", version: 2 }),
                            conditions: [
                              {
                                id: crypto.randomUUID(),
                                attribute: "name",
                                trait: null,
                                operator: "=",
                                targetType: "text",
                                targetValues: ["Alice"],
                              },
                            ],
                          },
                        ],
                        defaultValue: JSON.stringify({ theme: "light", version: 1 }),
                      },
                    },
                  },
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      await client.initialize();

      expect(client.getValue("json-config", { theme: "default" }, { name: "Alice" })).toEqual({
        theme: "dark",
        version: 2,
      });
      expect(client.getValue("json-config", { theme: "default" }, { name: "Bob" })).toEqual({
        theme: "light",
        version: 1,
      });
    });

    test("watch delivers the rule-matched json value for the registered context", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {
                    "json-config": {
                      id: "00000000-0000-0000-0000-000000000001",
                      key: "json-config",
                      type: "json",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [
                          {
                            id: crypto.randomUUID(),
                            order: 0,
                            type: "conditional",
                            target: "value",
                            percentages: null,
                            value: JSON.stringify({ theme: "dark", version: 2 }),
                            conditions: [
                              {
                                id: crypto.randomUUID(),
                                attribute: "name",
                                trait: null,
                                operator: "=",
                                targetType: "text",
                                targetValues: ["Alice"],
                              },
                            ],
                          },
                        ],
                        defaultValue: JSON.stringify({ theme: "light", version: 1 }),
                      },
                    },
                  },
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      const watchedValue = new Promise<object>((resolve) => {
        client.watch("json-config", { theme: "default" }, (value) => resolve(value), { name: "Alice" });
      });
      await client.initialize();

      await expect(watchedValue).resolves.toEqual({ theme: "dark", version: 2 });
    });
  });

  test("returns the evaluated config value when the server sends the config set", async () => {
    server.use(
      http.post(SSE_URL, async () => {
        const stream = new ReadableStream({
          start(controller) {
            setTimeout(() => {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {
                    "example-config": {
                      id: "00000000-0000-0000-0000-0000000011d0",
                      key: "example-config",
                      type: "float",
                      typeConstraints: {
                        min: {
                          relation: ">=",
                          value: 0,
                        },
                      },
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [],
                        defaultValue: "50",
                      },
                    },
                  },
                }),
              );
            }, 200);
          },
        });

        return buildResponse(stream);
      }),
    );

    const client = createClient("sdk-key", { logger, connection: { timeout: 100 } });
    const subscription = new Promise<number>((resolve) => {
      client.watch("example-config", 0, (value) => {
        resolve(value);
      });
    });
    await client.initialize();

    expect(client.getValue("example-config", 1)).toBe(1);
    expect(await subscription).toBe(50);
    expect(client.getValue("example-config", 1)).toBe(50);
  });

  test("evaluates targeting rules based on the provided user context", async () => {
    server.use(
      http.post(SSE_URL, async () => {
        const stream = new ReadableStream({
          start(controller) {
            setTimeout(() => {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {
                    "example-config": {
                      id: "00000000-0000-0000-0000-0000000011d0",
                      key: "example-config",
                      type: "float",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [
                          {
                            id: crypto.randomUUID(),
                            order: 0,
                            type: "conditional",
                            target: "value",
                            percentages: null,
                            value: "4.5",
                            conditions: [
                              {
                                id: crypto.randomUUID(),
                                attribute: "appVersion",
                                trait: null,
                                operator: ">=",
                                targetType: "semver",
                                targetValues: ["1.0.0"],
                              },
                            ],
                          },
                          {
                            id: crypto.randomUUID(),
                            order: 1,
                            type: "conditional",
                            target: "value",
                            percentages: null,
                            value: "10.1",
                            conditions: [
                              {
                                id: crypto.randomUUID(),
                                attribute: "name",
                                trait: null,
                                operator: "=",
                                targetType: "text",
                                targetValues: ["John"],
                              },
                            ],
                          },
                        ],
                        defaultValue: "50",
                      },
                    },
                  },
                }),
              );
            }, 10);
          },
        });

        return buildResponse(stream);
      }),
    );

    const client = createClient("sdk-key", { logger });
    const subscription = new Promise<number>((resolve) => {
      client.watch("example-config", 0, (value) => resolve(value), { name: "John" });
    });
    await client.initialize();

    expect(await subscription).toBe(10.1);
    expect(client.getValue("example-config", 1, { name: "Not John" })).toBe(50);
    expect(client.getValue("example-config", 1, { name: "John" })).toBe(10.1);
  });

  test("evaluates targeting rules based on the provided meta context", async () => {
    server.use(
      http.post(SSE_URL, async () => {
        const stream = new ReadableStream({
          start(controller) {
            setTimeout(() => {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {
                    "example-config": {
                      id: "00000000-0000-0000-0000-0000000011d0",
                      key: "example-config",
                      type: "float",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [
                          {
                            id: crypto.randomUUID(),
                            order: 0,
                            type: "conditional",
                            target: "value",
                            percentages: null,
                            value: "10.1",
                            conditions: [
                              {
                                id: crypto.randomUUID(),
                                attribute: "name",
                                trait: null,
                                operator: "=",
                                targetType: "text",
                                targetValues: ["John"],
                              },
                            ],
                          },
                          {
                            id: crypto.randomUUID(),
                            order: 1,
                            type: "conditional",
                            target: "value",
                            percentages: null,
                            value: "4.5",
                            conditions: [
                              {
                                id: crypto.randomUUID(),
                                attribute: "appVersion",
                                trait: null,
                                operator: ">=",
                                targetType: "semver",
                                targetValues: ["1.0.0"],
                              },
                            ],
                          },
                        ],
                        defaultValue: "50",
                      },
                    },
                  },
                }),
              );
            }, 10);
          },
        });

        return buildResponse(stream);
      }),
    );

    const client = createClient("sdk-key", { logger, metadata: { appVersion: "1.0.1" } });
    const subscription = new Promise<number>((resolve) => {
      client.watch("example-config", 0, (value) => resolve(value));
    });
    await client.initialize();

    expect(await subscription).toBe(4.5);
    expect(client.getValue("example-config", 1, { name: "Not John" })).toBe(4.5);
    expect(client.getValue("example-config", 1, { name: "John" })).toBe(10.1);
  });

  describe("default value validation", () => {
    test("throws when the default value is null", () => {
      const client = createClient("sdk-key", { logger });
      expect(() => client.getValue("key", null as any)).toThrow();
      expect(() => client.watch("key", null as any, () => {})).toThrow();
    });

    test("throws when the default value is undefined", () => {
      const client = createClient("sdk-key", { logger });
      expect(() => client.getValue("key", undefined as any)).toThrow();
      expect(() => client.watch("key", undefined as any, () => {})).toThrow();
    });

    test("throws when the default value is a function", () => {
      const client = createClient("sdk-key", { logger });
      expect(() => client.getValue("key", (() => "value") as any)).toThrow();
      expect(() => client.watch("key", (() => "value") as any, () => {})).toThrow();
    });
  });

  describe("delta bundle handling", () => {
    test("merges delta configs into the existing config set without affecting other keys", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {
                    "config-a": {
                      id: "00000000-0000-0000-0000-000000000001",
                      key: "config-a",
                      type: "string",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [],
                        defaultValue: "original-a",
                      },
                    },
                    "config-b": {
                      id: "00000000-0000-0000-0000-000000000002",
                      key: "config-b",
                      type: "string",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [],
                        defaultValue: "original-b",
                      },
                    },
                  },
                }),
              );
              setTimeout(() => {
                controller.enqueue(
                  message({
                    environmentId: "10000000-0000-0000-0000-000000000000",
                    projectId: "20000000-0000-0000-0000-000000000000",
                    kind: "delta",
                    configs: {
                      "config-a": {
                        id: "00000000-0000-0000-0000-000000000001",
                        key: "config-a",
                        type: "string",
                        variations: [],
                        target: {
                          environmentId: "10000000-0000-0000-0000-000000000000",
                          rules: [],
                          defaultValue: "updated-a",
                        },
                      },
                    },
                  }),
                );
              }, 10);
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      await client.initialize();
      await sleep(50);

      expect(client.getValue("config-a", "default")).toBe("updated-a");
      expect(client.getValue("config-b", "default")).toBe("original-b");
    });
  });

  describe("watch and unwatch", () => {
    const configWithValue = (key: string, value: string) => ({
      id: "00000000-0000-0000-0000-000000000001",
      key,
      type: "string",
      variations: [],
      target: { environmentId: "10000000-0000-0000-0000-000000000000", rules: [], defaultValue: value },
    });

    const fullBundle = (configs: Record<string, unknown>) => ({
      environmentId: "10000000-0000-0000-0000-000000000000",
      projectId: "20000000-0000-0000-0000-000000000000",
      kind: "full",
      configs,
    });

    test("watch() returns an unsubscribe function that removes the handler", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message(fullBundle({ "example-config": configWithValue("example-config", "Hello") })),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      let callCount = 0;
      const unsubscribe = client.watch("example-config", "default", () => {
        callCount++;
      });
      unsubscribe();
      await client.initialize();

      expect(callCount).toBe(0);
    });

    test("unwatch(key, callback) removes only the specified handler", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message(fullBundle({ "example-config": configWithValue("example-config", "Hello") })),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      let count1 = 0;
      let count2 = 0;
      const cb1 = () => {
        count1++;
      };
      client.watch("example-config", "default", cb1);
      client.watch("example-config", "default", () => {
        count2++;
      });
      client.unwatch("example-config", cb1);
      await client.initialize();

      expect(count1).toBe(0);
      expect(count2).toBe(1);
    });

    test("unwatch(key) without callback removes all handlers for the key", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message(fullBundle({ "example-config": configWithValue("example-config", "Hello") })),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      let count1 = 0;
      let count2 = 0;
      client.watch("example-config", "default", () => {
        count1++;
      });
      client.watch("example-config", "default", () => {
        count2++;
      });
      client.unwatch("example-config");
      await client.initialize();

      expect(count1).toBe(0);
      expect(count2).toBe(0);
    });

    test("unwatchAll() clears all watch handlers across all keys", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message(
                  fullBundle({
                    "config-a": configWithValue("config-a", "Hello"),
                    "config-b": configWithValue("config-b", "World"),
                  }),
                ),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      let countA = 0;
      let countB = 0;
      client.watch("config-a", "default", () => {
        countA++;
      });
      client.watch("config-b", "default", () => {
        countB++;
      });
      client.unwatchAll();
      await client.initialize();

      expect(countA).toBe(0);
      expect(countB).toBe(0);
    });

    test("fires all watchers registered for the same key", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message(fullBundle({ "example-config": configWithValue("example-config", "Hello") })),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      let callCount = 0;
      client.watch("example-config", "default", () => {
        callCount++;
      });
      client.watch("example-config", "default", () => {
        callCount++;
      });
      await client.initialize();

      expect(callCount).toBe(2);
    });
  });

  describe("event management", () => {
    test("off(event, handler) removes only the specified listener", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {},
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      let count = 0;
      const handler = () => {
        count++;
      };
      client.on("configsUpdated", handler);
      client.off("configsUpdated", handler);
      await client.initialize();

      expect(count).toBe(0);
    });

    test("off(event) without handler removes all listeners for that event", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {},
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      let count = 0;
      client.on("configsUpdated", () => {
        count++;
      });
      client.on("configsUpdated", () => {
        count++;
      });
      client.off("configsUpdated");
      await client.initialize();

      expect(count).toBe(0);
    });

    test("removeAllObservers() clears both event listeners and watch handlers", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {
                    "example-config": {
                      id: "00000000-0000-0000-0000-000000000001",
                      key: "example-config",
                      type: "string",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [],
                        defaultValue: "Hello",
                      },
                    },
                  },
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      let eventCount = 0;
      let watchCount = 0;
      client.on("configsUpdated", () => {
        eventCount++;
      });
      client.watch("example-config", "default", () => {
        watchCount++;
      });
      (client as DefaultConfigDirectorClient).removeAllObservers();
      await client.initialize();

      expect(eventCount).toBe(0);
      expect(watchCount).toBe(0);
    });
  });

  describe("connection management", () => {
    test("closeConnection() sets isReady to false", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {},
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      await client.initialize();
      expect(client.isReady).toBe(true);

      (client as DefaultConfigDirectorClient).closeConnection();

      expect(client.isReady).toBe(false);
    });

    test("dispose() closes the connection and removes all observers", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {},
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const client = createClient("sdk-key", { logger });
      await client.initialize();
      expect(client.isReady).toBe(true);

      client.dispose();

      expect(client.isReady).toBe(false);
    });
  });

  describe("hooks option", () => {
    const makeSseHandler = () =>
      http.post(SSE_URL, () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              message({
                environmentId: "10000000-0000-0000-0000-000000000000",
                projectId: "20000000-0000-0000-0000-000000000000",
                kind: "full",
                configs: {},
              }),
            );
          },
        });
        return buildResponse(stream);
      });

    test("registers a single clientReady handler", async () => {
      server.use(makeSseHandler());
      const handler = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { clientReady: handler } });

      await client.initialize();

      expect(handler).toHaveBeenCalledOnce();
    });

    test("registers multiple clientReady handlers", async () => {
      server.use(makeSseHandler());
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { clientReady: [handler1, handler2] } });

      await client.initialize();

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    test("registers a single configsUpdated handler", async () => {
      server.use(makeSseHandler());
      const handler = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { configsUpdated: handler } });

      await client.initialize();

      expect(handler).toHaveBeenCalledOnce();
    });

    test("registers multiple configsUpdated handlers", async () => {
      server.use(makeSseHandler());
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { configsUpdated: [handler1, handler2] } });

      await client.initialize();

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    test("registers a single configEvaluated handler", async () => {
      server.use(makeSseHandler());
      const handler = vi.fn();
      const client = createClient("sdk-key", { logger, hooks: { configEvaluated: handler } });
      await client.initialize();
      client.getValue("any-config", "default");
      await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    });

    test("registers multiple configEvaluated handlers", async () => {
      server.use(makeSseHandler());
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

  describe("configEvaluated", () => {
    const makeFullSseHandler = (configs: Record<string, unknown>) =>
      http.post(SSE_URL, async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              message({
                environmentId: "10000000-0000-0000-0000-000000000000",
                projectId: "20000000-0000-0000-0000-000000000000",
                kind: "full",
                configs,
              }),
            );
          },
        });
        return buildResponse(stream);
      });

    const serverConfig = (key: string, type: string, value: string) => ({
      id: "00000000-0000-0000-0000-000000000001",
      key,
      type,
      variations: [],
      target: {
        environmentId: "10000000-0000-0000-0000-000000000000",
        rules: [],
        defaultValue: value,
      },
    });

    test("emits with reason 'client-not-ready' before initialization", async () => {
      const client = createClient("sdk-key", { logger });
      const events: any[] = [];
      client.on("configEvaluated", (e) => events.push(e));

      client.getValue("missing-config", "default");

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(events[0].evaluation).toEqual({
        key: "missing-config",
        value: "default",
        isDefaultValue: true,
        reason: "client-not-ready",
      });
    });

    test("emits with reason 'config-state-missing' when the key is absent after initialization", async () => {
      server.use(makeFullSseHandler({}));
      const client = createClient("sdk-key", { logger });
      await client.initialize();
      const events: any[] = [];
      client.on("configEvaluated", (e) => events.push(e));

      client.getValue("missing-config", "default");

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(events[0].evaluation).toEqual({
        key: "missing-config",
        value: "default",
        isDefaultValue: true,
        reason: "config-state-missing",
      });
    });

    test("emits with reason 'found-match' for a matching string config", async () => {
      server.use(makeFullSseHandler({ "my-config": serverConfig("my-config", "string", "server-value") }));
      const client = createClient("sdk-key", { logger });
      await client.initialize();
      const events: any[] = [];
      client.on("configEvaluated", (e) => events.push(e));

      client.getValue("my-config", "default");

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(events[0].evaluation).toEqual({
        key: "my-config",
        value: "server-value",
        isDefaultValue: false,
        reason: "found-match",
      });
    });

    test("emits with reason 'value-missing' when the config has an empty value", async () => {
      server.use(makeFullSseHandler({ "my-config": serverConfig("my-config", "string", "") }));
      const client = createClient("sdk-key", { logger });
      await client.initialize();
      const events: any[] = [];
      client.on("configEvaluated", (e) => events.push(e));

      client.getValue("my-config", "default");

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(events[0].evaluation).toEqual({
        key: "my-config",
        value: "default",
        isDefaultValue: true,
        reason: "value-missing",
      });
    });

    test("emits with reason 'invalid-json' when a json config has malformed JSON", async () => {
      server.use(makeFullSseHandler({ "my-config": serverConfig("my-config", "json", "not-valid-json{") }));
      const client = createClient("sdk-key", { logger });
      await client.initialize();
      const events: any[] = [];
      client.on("configEvaluated", (e) => events.push(e));

      client.getValue("my-config", { greeting: "default" });

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(events[0].evaluation).toEqual({
        key: "my-config",
        value: { greeting: "default" },
        isDefaultValue: true,
        reason: "invalid-json",
      });
    });

    test("emits with reason 'invalid-number' when a string config is requested as a number", async () => {
      server.use(makeFullSseHandler({ "my-config": serverConfig("my-config", "string", "not-a-number") }));
      const client = createClient("sdk-key", { logger });
      await client.initialize();
      const events: any[] = [];
      client.on("configEvaluated", (e) => events.push(e));

      client.getValue("my-config", 42);

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(events[0].evaluation).toEqual({
        key: "my-config",
        value: 42,
        isDefaultValue: true,
        reason: "invalid-number",
      });
    });

    test("emits with reason 'invalid-boolean' when a string config is requested as a boolean", async () => {
      server.use(makeFullSseHandler({ "my-config": serverConfig("my-config", "string", "not-a-boolean") }));
      const client = createClient("sdk-key", { logger });
      await client.initialize();
      const events: any[] = [];
      client.on("configEvaluated", (e) => events.push(e));

      client.getValue("my-config", false);

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(events[0].evaluation).toEqual({
        key: "my-config",
        value: false,
        isDefaultValue: true,
        reason: "invalid-boolean",
      });
    });

    test("includes context in the event when context is passed to getValue", async () => {
      server.use(makeFullSseHandler({ "my-config": serverConfig("my-config", "string", "server-value") }));
      const client = createClient("sdk-key", { logger });
      await client.initialize();
      const events: any[] = [];
      client.on("configEvaluated", (e) => events.push(e));

      const context = { id: "user-123", name: "Alice", traits: {} };
      client.getValue("my-config", "default", context);

      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(events[0].evaluation).toEqual({
        key: "my-config",
        value: "server-value",
        isDefaultValue: false,
        reason: "found-match",
        context,
      });
    });
  });

  describe("telemetry", () => {
    test("includes the config type in the telemetry event for a JSON config", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {
                    "json-config": {
                      id: "00000000-0000-0000-0000-000000000001",
                      key: "json-config",
                      type: "json",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [],
                        defaultValue: JSON.stringify({ greeting: "hello" }),
                      },
                    },
                  },
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const spy = vi.spyOn(ServerTelemetryEventCollector.prototype, "evaluatedConfig");
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      client.getValue("json-config", { greeting: "default" });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          evaluation: expect.objectContaining({ type: "json" }),
        }),
      );
    });

    test("includes the config type in the telemetry event for a string config", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {
                    "string-config": {
                      id: "00000000-0000-0000-0000-000000000001",
                      key: "string-config",
                      type: "string",
                      variations: [],
                      target: {
                        environmentId: "10000000-0000-0000-0000-000000000000",
                        rules: [],
                        defaultValue: "hello",
                      },
                    },
                  },
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const spy = vi.spyOn(ServerTelemetryEventCollector.prototype, "evaluatedConfig");
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      client.getValue("string-config", "default");

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          evaluation: expect.objectContaining({ type: "string" }),
        }),
      );
    });

    test("reports an evaluation event when getValue is called", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {},
                }),
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const spy = vi.spyOn(ServerTelemetryEventCollector.prototype, "evaluatedConfig");
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      client.getValue("example-config", "default-value");

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          evaluation: expect.objectContaining({
            key: "example-config",
            evaluatedValue: "default-value",
            usedDefault: true,
          }),
        }),
      );
    });
  });
});
