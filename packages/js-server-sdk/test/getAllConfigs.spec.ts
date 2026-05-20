import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { setupServer } from "msw/node";
import { http } from "msw";
import { createClient } from "../src";
import { createStubbedLogger, SSE_URL } from "./helpers";

const buildResponse = (stream: ReadableStream) =>
  new Response(stream, {
    headers: { connection: "keep-alive", "content-type": "text/event-stream", "cache-control": "no-cache" },
  });

const message = (data: unknown) => new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

const BUNDLE_BASE = {
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "full",
};

const CONFIGS = {
  "feature-flag": {
    id: "00000000-0000-0000-0000-000000000001",
    key: "feature-flag",
    type: "boolean",
    variations: [],
    target: { rules: [], defaultValue: "true" },
  },
  "greeting": {
    id: "00000000-0000-0000-0000-000000000002",
    key: "greeting",
    type: "string",
    variations: [],
    target: { rules: [], defaultValue: "Hello" },
  },
  "item-count": {
    id: "00000000-0000-0000-0000-000000000003",
    key: "item-count",
    type: "integer",
    variations: [],
    target: { rules: [], defaultValue: "42" },
  },
};

const server = setupServer();
const logger = createStubbedLogger();

describe("getAllConfigs", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => server.resetHandlers());
  afterAll(() => server.close());

  test("returns an empty object when the client is not yet ready", async () => {
    server.use(
      http.post(SSE_URL, () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message({ ...BUNDLE_BASE, configs: CONFIGS }));
            },
          }),
        ),
      ),
    );

    const client = createClient("sdk-key", { logger, connection: { timeout: 1 } });
    // Don't initialize — client is not ready
    expect(client.getAllConfigs()).toEqual({});
  });

  test("returns a ConfigState for every config in the set", async () => {
    server.use(
      http.post(SSE_URL, () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message({ ...BUNDLE_BASE, configs: CONFIGS }));
            },
          }),
        ),
      ),
    );

    const client = createClient("sdk-key", { logger });
    await client.initialize();

    const result = client.getAllConfigs();

    expect(Object.keys(result)).toEqual(expect.arrayContaining(["feature-flag", "greeting", "item-count"]));
    expect(result["feature-flag"]).toMatchObject({ key: "feature-flag", type: "boolean", value: "true" });
    expect(result["greeting"]).toMatchObject({ key: "greeting", type: "string", value: "Hello" });
    expect(result["item-count"]).toMatchObject({ key: "item-count", type: "integer", value: "42" });
  });

  test("filters the result to the specified configKeys", async () => {
    server.use(
      http.post(SSE_URL, () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message({ ...BUNDLE_BASE, configs: CONFIGS }));
            },
          }),
        ),
      ),
    );

    const client = createClient("sdk-key", { logger });
    await client.initialize();

    const result = client.getAllConfigs({ configKeys: ["feature-flag", "greeting"] });

    expect(Object.keys(result)).toHaveLength(2);
    expect(result["feature-flag"]).toBeDefined();
    expect(result["greeting"]).toBeDefined();
    expect(result["item-count"]).toBeUndefined();
  });

  test("silently omits unknown keys from the configKeys filter", async () => {
    server.use(
      http.post(SSE_URL, () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message({ ...BUNDLE_BASE, configs: CONFIGS }));
            },
          }),
        ),
      ),
    );

    const client = createClient("sdk-key", { logger });
    await client.initialize();

    const result = client.getAllConfigs({ configKeys: ["greeting", "does-not-exist"] });

    expect(Object.keys(result)).toHaveLength(1);
    expect(result["greeting"]).toBeDefined();
  });

  test("evaluates configs against the provided context", async () => {
    server.use(
      http.post(SSE_URL, () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  ...BUNDLE_BASE,
                  configs: {
                    "feature-flag": {
                      id: "00000000-0000-0000-0000-000000000001",
                      key: "feature-flag",
                      type: "boolean",
                      variations: [],
                      target: {
                        rules: [
                          {
                            id: crypto.randomUUID(),
                            order: 0,
                            type: "conditional",
                            target: "value",
                            percentages: null,
                            value: "false",
                            conditions: [
                              {
                                id: crypto.randomUUID(),
                                attribute: "name",
                                trait: null,
                                operator: "equals",
                                targetType: "text",
                                targetValues: ["beta-user"],
                              },
                            ],
                          },
                        ],
                        defaultValue: "true",
                      },
                    },
                  },
                }),
              );
            },
          }),
        ),
      ),
    );

    const client = createClient("sdk-key", { logger });
    await client.initialize();

    const defaultResult = client.getAllConfigs();
    expect(defaultResult["feature-flag"]).toMatchObject({ value: "true" });

    const betaResult = client.getAllConfigs({ context: { name: "beta-user" } });
    expect(betaResult["feature-flag"]).toMatchObject({ value: "false" });
  });
});
