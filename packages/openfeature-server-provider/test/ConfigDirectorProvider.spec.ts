import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { OpenFeature, ProviderEvents } from "@openfeature/server-sdk";
import { ConfigDirectorProvider } from "../src";
import { SSE_URL, POLLING_URL, createStubbedLogger } from "./helpers";

const buildResponse = (stream: ReadableStream) => {
  return new Response(stream, {
    headers: {
      connection: "keep-alive",
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
};

const message = (data: unknown) => new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

const sseHandler = (enqueue: (controller: ReadableStreamDefaultController) => void) =>
  http.post(SSE_URL, async () => buildResponse(new ReadableStream({ start: enqueue })));

const configWithValue = (key: string, type: string, defaultValue: string, rules: unknown[] = []) => ({
  id: "00000000-0000-0000-0000-000000000001",
  key,
  type,
  variations: [],
  target: {
    environmentId: "10000000-0000-0000-0000-000000000000",
    rules,
    defaultValue,
  },
});

const fullBundle = (configs: Record<string, unknown> = {}) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "full" as const,
  configs,
});

const deltaBundle = (configs: Record<string, unknown> = {}) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "delta" as const,
  configs,
});

const server = setupServer();
const logger = createStubbedLogger();

// These tests exercise ConfigDirectorProvider the way a real consumer would: registered with the
// OpenFeature server SDK and evaluated through an OpenFeature client, with the ConfigDirector server
// SDK stubbed out via msw.
describe("ConfigDirectorProvider (via @openfeature/server-sdk)", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  beforeEach(() => server.resetHandlers());

  afterEach(async () => {
    await OpenFeature.clearProviders();
    OpenFeature.setContext({});
    OpenFeature.clearHandlers();
    OpenFeature.clearHooks();
    await OpenFeature.close();
  });

  afterAll(() => server.close());

  test("resolves boolean, string, number, and object flags once the provider is ready", async () => {
    let requestJson: any = undefined;
    server.use(
      http.post(SSE_URL, async ({ request }) => {
        requestJson = await request.json();
        return buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                message(
                  fullBundle({
                    "show-banner": configWithValue("show-banner", "boolean", "true"),
                    greeting: configWithValue("greeting", "string", "Bye"),
                    "max-items": configWithValue("max-items", "integer", "42"),
                    settings: configWithValue("settings", "json", JSON.stringify({ theme: "dark" })),
                  }),
                ),
              );
            },
          }),
        );
      }),
    );

    await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
    const client = OpenFeature.getClient();

    expect(await client.getBooleanValue("show-banner", false)).toBe(true);
    expect(await client.getStringValue("greeting", "Hello")).toBe("Bye");
    expect(await client.getNumberValue("max-items", 0)).toBe(42);
    expect(await client.getObjectValue("settings", { theme: "light" })).toEqual({ theme: "dark" });

    expect(requestJson?.serverSdkKey).toBe("sdk-key");
    expect(requestJson?.metaContext).toMatchObject({
      sdkName: "js-openfeature-server-provider",
      sdkVersion: "__VERSION__",
    });
  });

  test("returns the caller-supplied default value when a flag was not sent by the server", async () => {
    server.use(sseHandler((controller) => controller.enqueue(message(fullBundle()))));

    await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
    const client = OpenFeature.getClient();

    expect(await client.getBooleanValue("missing-flag", true)).toBe(true);
    expect(await client.getStringValue("missing-flag", "fallback")).toBe("fallback");
    expect(await client.getNumberValue("missing-flag", 7)).toBe(7);
  });

  test("maps the OpenFeature evaluation context passed to flag evaluations onto the ConfigDirector context used for targeting rules", async () => {
    server.use(
      sseHandler((controller) =>
        controller.enqueue(
          message(
            fullBundle({
              greeting: configWithValue("greeting", "string", "Bye", [
                {
                  id: crypto.randomUUID(),
                  order: 0,
                  type: "conditional",
                  target: "value",
                  percentages: null,
                  value: "Hello",
                  conditions: [
                    {
                      id: crypto.randomUUID(),
                      attribute: "name",
                      trait: null,
                      operator: "=",
                      targetType: "text",
                      targetValues: ["Ada Lovelace"],
                    },
                  ],
                },
              ]),
            }),
          ),
        ),
      ),
    );

    await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
    const client = OpenFeature.getClient();

    expect(
      await client.getStringValue("greeting", "default", {
        targetingKey: "user-123",
        name: "Ada Lovelace",
        traits: { email: "ada@example.com" },
      }),
    ).toBe("Hello");
    expect(await client.getStringValue("greeting", "default", { name: "Bob" })).toBe("Bye");
  });

  test("supports the 'polling' connection mode configured via clientOptions", async () => {
    server.use(
      http.post(POLLING_URL, () =>
        HttpResponse.json(fullBundle({ greeting: configWithValue("greeting", "string", "from-pull") })),
      ),
    );

    await OpenFeature.setProviderAndWait(
      new ConfigDirectorProvider("sdk-key", { logger, connection: { mode: "polling" } }),
    );

    expect(await OpenFeature.getClient().getStringValue("greeting", "default")).toBe("from-pull");
  });

  test("serves offline values to OpenFeature evaluations without an SDK key or a request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await OpenFeature.setProviderAndWait(
      new ConfigDirectorProvider({
        logger,
        connection: { mode: "offline", values: { "show-banner": true, greeting: "Bye", "max-items": 42 } },
      }),
    );
    const client = OpenFeature.getClient();

    expect(await client.getBooleanValue("show-banner", false, { targetingKey: "user-123" })).toBe(true);
    expect(await client.getStringValue("greeting", "Hello")).toBe("Bye");
    expect(await client.getNumberValue("max-items", 0)).toBe(42);
    await OpenFeature.clearProviders();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("onClose disposes the underlying ConfigDirector client without throwing", async () => {
    server.use(sseHandler((controller) => controller.enqueue(message(fullBundle()))));

    const provider = new ConfigDirectorProvider("sdk-key", { logger });
    await OpenFeature.setProviderAndWait(provider);

    await expect(OpenFeature.clearProviders()).resolves.toBeUndefined();
  });

  describe("context kinds", () => {
    const attributeCondition = (attribute: string, trait: string | null, targetValue: string) => ({
      id: crypto.randomUUID(),
      attribute,
      trait,
      operator: "equals",
      targetType: "text",
      targetValues: [targetValue],
    });
    const valueRule = (order: number, value: string, condition: unknown) => ({
      id: crypto.randomUUID(),
      order,
      type: "conditional",
      target: "value",
      percentages: null,
      value,
      conditions: [condition],
    });
    const greeting = configWithValue("greeting", "string", "hello everyone", [
      valueRule(0, "hello device", attributeCondition("kind", null, "device")),
      valueRule(1, "hello kind trait", attributeCondition("traits", "/kind", "device")),
      valueRule(2, "hello 42", attributeCondition("identifier", null, "42")),
    ]);

    test("maps a top-level kind onto the ConfigDirector context kind", async () => {
      server.use(sseHandler((controller) => controller.enqueue(message(fullBundle({ greeting })))));
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
      const client = OpenFeature.getClient();

      const value = await client.getStringValue("greeting", "in-code default", {
        targetingKey: "42",
        kind: "device",
      });

      expect(value).toBe("hello device");
    });

    test("keeps a kind inside traits as an ordinary trait", async () => {
      server.use(sseHandler((controller) => controller.enqueue(message(fullBundle({ greeting })))));
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
      const client = OpenFeature.getClient();

      const value = await client.getStringValue("greeting", "in-code default", {
        targetingKey: "42",
        traits: { kind: "device" },
      });

      expect(value).toBe("hello kind trait");
    });

    test("resolves a context with an invalid kind successfully to the value for no context", async () => {
      server.use(sseHandler((controller) => controller.enqueue(message(fullBundle({ greeting })))));
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
      const client = OpenFeature.getClient();

      const details = await client.getStringDetails("greeting", "in-code default", {
        targetingKey: "42",
        kind: "Tenant",
      });

      expect(details.value).toBe("hello everyone");
      expect(details.errorCode).toBeUndefined();
    });

    test("treats a top-level kind that is not text as an invalid kind", async () => {
      server.use(sseHandler((controller) => controller.enqueue(message(fullBundle({ greeting })))));
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
      const client = OpenFeature.getClient();

      const value = await client.getStringValue("greeting", "in-code default", {
        targetingKey: "42",
        kind: 42,
      });

      expect(value).toBe("hello everyone");
    });
  });

  describe("evaluation details", () => {
    test("resolves a served value with TARGETING_MATCH and its value ID as the variant", async () => {
      server.use(
        sseHandler((controller) =>
          controller.enqueue(
            message(
              fullBundle({
                "dark-mode": {
                  ...configWithValue("dark-mode", "boolean", "true"),
                  target: {
                    environmentId: "10000000-0000-0000-0000-000000000000",
                    rules: [],
                    defaultValue: "true",
                    defaultValueId: "value-id-dark-mode-on",
                  },
                },
              }),
            ),
          ),
        ),
      );
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      const details = await OpenFeature.getClient().getBooleanDetails("dark-mode", false);

      expect(details).toEqual({
        flagKey: "dark-mode",
        flagMetadata: {},
        value: true,
        reason: "TARGETING_MATCH",
        variant: "value-id-dark-mode-on",
      });
    });

    test("resolves a served value with no variant when the payload carries no value ID", async () => {
      server.use(
        sseHandler((controller) =>
          controller.enqueue(
            message(fullBundle({ "dark-mode": configWithValue("dark-mode", "boolean", "true") })),
          ),
        ),
      );
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      const details = await OpenFeature.getClient().getBooleanDetails("dark-mode", false);

      expect(details).toEqual({
        flagKey: "dark-mode",
        flagMetadata: {},
        value: true,
        reason: "TARGETING_MATCH",
        variant: undefined,
      });
    });

    test("resolves a config without a value to the in-code default value with DEFAULT", async () => {
      server.use(
        sseHandler((controller) =>
          controller.enqueue(message(fullBundle({ greeting: configWithValue("greeting", "string", "") }))),
        ),
      );
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      const details = await OpenFeature.getClient().getStringDetails("greeting", "Hello");

      expect(details).toEqual({
        flagKey: "greeting",
        flagMetadata: {},
        value: "Hello",
        reason: "DEFAULT",
      });
    });

    test("resolves a config that does not exist to the in-code default value with FLAG_NOT_FOUND", async () => {
      server.use(sseHandler((controller) => controller.enqueue(message(fullBundle()))));
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      const details = await OpenFeature.getClient().getBooleanDetails("missing-flag", false);

      expect(details).toEqual({
        flagKey: "missing-flag",
        flagMetadata: {},
        value: false,
        reason: "ERROR",
        errorCode: "FLAG_NOT_FOUND",
        errorMessage: expect.stringMatching(/\S/),
      });
    });

    test("resolves a flag before values arrive to the in-code default value with PROVIDER_NOT_READY", async () => {
      server.use(http.post(SSE_URL, () => new HttpResponse(null, { status: 503 })));
      await OpenFeature.setProviderAndWait(
        new ConfigDirectorProvider("sdk-key", { logger, connection: { timeout: 100 } }),
      );

      const details = await OpenFeature.getClient().getBooleanDetails("dark-mode", false);

      expect(details).toEqual({
        flagKey: "dark-mode",
        flagMetadata: {},
        value: false,
        reason: "ERROR",
        errorCode: "PROVIDER_NOT_READY",
        errorMessage: expect.stringMatching(/\S/),
      });
    });

    test("resolves a boolean config read as a string to the in-code default value with TYPE_MISMATCH", async () => {
      server.use(
        sseHandler((controller) =>
          controller.enqueue(
            message(fullBundle({ "dark-mode": configWithValue("dark-mode", "boolean", "true") })),
          ),
        ),
      );
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      const details = await OpenFeature.getClient().getStringDetails("dark-mode", "off");

      expect(details).toEqual({
        flagKey: "dark-mode",
        flagMetadata: {},
        value: "off",
        reason: "ERROR",
        errorCode: "TYPE_MISMATCH",
        errorMessage: expect.stringMatching(/\S/),
      });
    });

    test("resolves a string config that is not a number read as a number to the in-code default value with TYPE_MISMATCH", async () => {
      server.use(
        sseHandler((controller) =>
          controller.enqueue(
            message(fullBundle({ "max-items": configWithValue("max-items", "string", "many") })),
          ),
        ),
      );
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      const details = await OpenFeature.getClient().getNumberDetails("max-items", 7);

      expect(details).toEqual({
        flagKey: "max-items",
        flagMetadata: {},
        value: 7,
        reason: "ERROR",
        errorCode: "TYPE_MISMATCH",
        errorMessage: expect.stringMatching(/\S/),
      });
    });

    test("resolves a json config with malformed JSON to the in-code default value with TYPE_MISMATCH", async () => {
      server.use(
        sseHandler((controller) =>
          controller.enqueue(
            message(fullBundle({ settings: configWithValue("settings", "json", "not-valid-json{") })),
          ),
        ),
      );
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      const details = await OpenFeature.getClient().getObjectDetails("settings", { theme: "light" });

      expect(details).toEqual({
        flagKey: "settings",
        flagMetadata: {},
        value: { theme: "light" },
        reason: "ERROR",
        errorCode: "TYPE_MISMATCH",
        errorMessage: expect.stringMatching(/\S/),
      });
    });

    test("resolves a string config that is not a boolean read as a boolean to the in-code default value with TYPE_MISMATCH", async () => {
      server.use(
        sseHandler((controller) =>
          controller.enqueue(
            message(fullBundle({ "dark-mode": configWithValue("dark-mode", "string", "sometimes") })),
          ),
        ),
      );
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      const details = await OpenFeature.getClient().getBooleanDetails("dark-mode", false);

      expect(details).toEqual({
        flagKey: "dark-mode",
        flagMetadata: {},
        value: false,
        reason: "ERROR",
        errorCode: "TYPE_MISMATCH",
        errorMessage: expect.stringMatching(/\S/),
      });
    });
  });

  describe("hooks", () => {
    test("runs an after hook that sees TARGETING_MATCH and the value ID for a served value", async () => {
      server.use(
        sseHandler((controller) =>
          controller.enqueue(
            message(
              fullBundle({
                "new-checkout": {
                  ...configWithValue("new-checkout", "boolean", "true"),
                  target: {
                    environmentId: "10000000-0000-0000-0000-000000000000",
                    rules: [],
                    defaultValue: "true",
                    defaultValueId: "value-id-new-checkout-on",
                  },
                },
              }),
            ),
          ),
        ),
      );
      const afterHookDetails: unknown[] = [];
      OpenFeature.addHooks({ after: (_hookContext, details) => void afterHookDetails.push(details) });
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      await OpenFeature.getClient().getBooleanValue("new-checkout", false);

      expect(afterHookDetails).toEqual([
        expect.objectContaining({ reason: "TARGETING_MATCH", variant: "value-id-new-checkout-on" }),
      ]);
    });

    test("runs an error hook that sees FLAG_NOT_FOUND for a config that does not exist", async () => {
      server.use(
        sseHandler((controller) =>
          controller.enqueue(
            message(fullBundle({ "new-checkout": configWithValue("new-checkout", "boolean", "true") })),
          ),
        ),
      );
      const errorHookErrors: unknown[] = [];
      OpenFeature.addHooks({ error: (_hookContext, error) => void errorHookErrors.push(error) });
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      const value = await OpenFeature.getClient().getBooleanValue("new-chekout", false);

      expect(value).toBe(false);
      expect(errorHookErrors).toEqual([expect.objectContaining({ code: "FLAG_NOT_FOUND" })]);
    });
  });

  describe("events", () => {
    test("notifies an OpenFeature client of PROVIDER_READY and PROVIDER_CONFIGURATION_CHANGED once the initial snapshot arrives", async () => {
      server.use(
        sseHandler((controller) =>
          controller.enqueue(
            message(fullBundle({ greeting: configWithValue("greeting", "string", "Hello") })),
          ),
        ),
      );

      const client = OpenFeature.getClient();

      const readyEvents: unknown[] = [];
      client.addHandler(ProviderEvents.Ready, (details: unknown) => readyEvents.push(details));
      const flagsChanged: (readonly string[] | undefined)[] = [];
      client.addHandler(ProviderEvents.ConfigurationChanged, (details: unknown) =>
        flagsChanged.push((details as { flagsChanged?: string[] } | undefined)?.flagsChanged),
      );

      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      expect(readyEvents.length).toBeGreaterThanOrEqual(1);
      expect(flagsChanged).toEqual([["greeting"]]);
    });

    test("emits PROVIDER_CONFIGURATION_CHANGED for each config push received after the provider is ready", async () => {
      server.use(
        sseHandler((controller) => {
          controller.enqueue(
            message(fullBundle({ greeting: configWithValue("greeting", "string", "Hello") })),
          );
          setTimeout(() => {
            controller.enqueue(
              message(deltaBundle({ greeting: configWithValue("greeting", "string", "Updated") })),
            );
          }, 10);
        }),
      );

      const client = OpenFeature.getClient();
      const flagsChanged: (readonly string[] | undefined)[] = [];
      client.addHandler(ProviderEvents.ConfigurationChanged, (details: unknown) =>
        flagsChanged.push((details as { flagsChanged?: string[] } | undefined)?.flagsChanged),
      );

      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      await vi.waitFor(() => expect(flagsChanged).toEqual([["greeting"], ["greeting"]]));
      expect(await client.getStringValue("greeting", "default")).toBe("Updated");
    });

    test("lists a flag removed by a full config push in PROVIDER_CONFIGURATION_CHANGED", async () => {
      server.use(
        sseHandler((controller) => {
          controller.enqueue(
            message(
              fullBundle({
                greeting: configWithValue("greeting", "string", "Hello"),
                farewell: configWithValue("farewell", "string", "Bye"),
              }),
            ),
          );
          setTimeout(() => {
            controller.enqueue(
              message(fullBundle({ greeting: configWithValue("greeting", "string", "Hello") })),
            );
          }, 10);
        }),
      );

      const client = OpenFeature.getClient();
      const flagsChanged: (readonly string[] | undefined)[] = [];
      client.addHandler(ProviderEvents.ConfigurationChanged, (details: unknown) =>
        flagsChanged.push((details as { flagsChanged?: string[] } | undefined)?.flagsChanged),
      );

      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      await vi.waitFor(() => expect(flagsChanged).toHaveLength(2));
      expect(flagsChanged[1]).toEqual(["greeting", "farewell"]);
      expect(await client.getStringValue("farewell", "default")).toBe("default");
    });
  });
});
