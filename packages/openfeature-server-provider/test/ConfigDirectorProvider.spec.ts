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

  test("supports the 'one-time' connection mode configured via clientOptions", async () => {
    server.use(
      http.post(POLLING_URL, () =>
        HttpResponse.json(fullBundle({ greeting: configWithValue("greeting", "string", "from-pull") })),
      ),
    );

    await OpenFeature.setProviderAndWait(
      new ConfigDirectorProvider("sdk-key", { logger, connection: { mode: "one-time" } }),
    );

    expect(await OpenFeature.getClient().getStringValue("greeting", "default")).toBe("from-pull");
  });

  test("onClose disposes the underlying ConfigDirector client without throwing", async () => {
    server.use(sseHandler((controller) => controller.enqueue(message(fullBundle()))));

    const provider = new ConfigDirectorProvider("sdk-key", { logger });
    await OpenFeature.setProviderAndWait(provider);

    await expect(OpenFeature.clearProviders()).resolves.toBeUndefined();
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
  });
});
