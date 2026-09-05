import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { commands } from "vitest/browser";
import { OpenFeature, ProviderEvents } from "@openfeature/web-sdk";
import { ConfigDirectorProvider } from "../src";
import { SSE_URL, POLL_URL, createStubbedLogger } from "./helpers";

const full = (configs: object = {}) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "full",
  configs,
});

const delta = (configs: object = {}) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "delta",
  configs,
});

const stringConfig = (key: string, value: string) => ({
  [key]: { id: "00000000-0000-0000-0000-000000000001", key, type: "string", value },
});

const boolConfig = (key: string, value: boolean) => ({
  [key]: { id: "00000000-0000-0000-0000-000000000002", key, type: "boolean", value: String(value) },
});

const numberConfig = (key: string, value: number) => ({
  [key]: { id: "00000000-0000-0000-0000-000000000003", key, type: "integer", value: String(value) },
});

const jsonConfig = (key: string, value: unknown) => ({
  [key]: { id: "00000000-0000-0000-0000-000000000004", key, type: "json", value: JSON.stringify(value) },
});

const logger = createStubbedLogger();

// These tests exercise ConfigDirectorProvider the way a real consumer would: registered with the
// OpenFeature web SDK and evaluated through an OpenFeature client, with the ConfigDirector SDK
// server stubbed out via msw.
describe("ConfigDirectorProvider (via @openfeature/web-sdk)", () => {
  beforeAll(async () => {
    await commands.mswSetup();
  });

  afterEach(async () => {
    await OpenFeature.clearProviders();
    await OpenFeature.clearContexts();
    OpenFeature.clearHandlers();
    await OpenFeature.close();
  });

  afterAll(async () => {
    await commands.mswTeardown();
  });

  test("resolves boolean, string, number, and object flags once the provider is ready", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          data: full({
            ...boolConfig("show-banner", true),
            ...stringConfig("greeting", "Bye"),
            ...numberConfig("max-items", 42),
            ...jsonConfig("settings", { theme: "dark" }),
          }),
        },
      ],
    ]);

    await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
    const client = OpenFeature.getClient();

    expect(client.getBooleanValue("show-banner", false)).toBe(true);
    expect(client.getStringValue("greeting", "Hello")).toBe("Bye");
    expect(client.getNumberValue("max-items", 0)).toBe(42);
    expect(client.getObjectValue("settings", { theme: "light" })).toEqual({ theme: "dark" });

    const payloads = await commands.mswGetPayloads();
    expect((payloads[0] as any)?.clientSdkKey).toBe("sdk-key");
    expect((payloads[0] as any)?.metaContext).toMatchObject({
      sdkName: "js-openfeature-web-provider",
      sdkVersion: "__VERSION__",
    });
  });

  test("returns the caller-supplied default value when a flag was not sent by the server", async () => {
    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

    await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
    const client = OpenFeature.getClient();

    expect(client.getBooleanValue("missing-flag", true)).toBe(true);
    expect(client.getStringValue("missing-flag", "fallback")).toBe("fallback");
    expect(client.getNumberValue("missing-flag", 7)).toBe(7);
  });

  test("maps the OpenFeature evaluation context passed to setProviderAndWait onto the ConfigDirector context", async () => {
    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

    await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }), {
      targetingKey: "user-123",
      name: "Ada Lovelace",
      traits: { email: "ada@example.com" },
      anonymous: false,
    });

    const payloads = await commands.mswGetPayloads();
    expect((payloads[0] as any)?.givenContext).toEqual({
      id: "user-123",
      name: "Ada Lovelace",
      traits: { email: "ada@example.com" },
      anonymous: false,
    });
  });

  test("re-evaluates flags after the OpenFeature context changes", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [{ data: full(stringConfig("greeting", "Hello")) }],
      [{ data: full(stringConfig("greeting", "Bye")) }],
    ]);

    await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
    const client = OpenFeature.getClient();
    expect(client.getStringValue("greeting", "default")).toBe("Hello");

    await OpenFeature.setContext({ targetingKey: "user-1", name: "Alice" });

    expect(client.getStringValue("greeting", "default")).toBe("Bye");

    const payloads = await commands.mswGetPayloads();
    expect(payloads).toHaveLength(2);
    expect((payloads[0] as any)?.givenContext).toEqual({});
    expect((payloads[1] as any)?.givenContext).toEqual({ id: "user-1", name: "Alice" });
  });

  test("supports the 'polling' connection mode configured via clientOptions", async () => {
    await commands.mswUseHandlers({
      url: POLL_URL,
      responseBody: full(stringConfig("greeting", "from-pull")),
    });

    await OpenFeature.setProviderAndWait(
      new ConfigDirectorProvider("sdk-key", { logger, connection: { mode: "polling" } }),
    );

    expect(OpenFeature.getClient().getStringValue("greeting", "default")).toBe("from-pull");
  });

  test("onClose disposes the underlying ConfigDirector client without throwing", async () => {
    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

    const provider = new ConfigDirectorProvider("sdk-key", { logger });
    await OpenFeature.setProviderAndWait(provider);

    await expect(OpenFeature.clearProviders()).resolves.toBeUndefined();
  });

  describe("events", () => {
    test("notifies an OpenFeature client of PROVIDER_READY and PROVIDER_CONFIGURATION_CHANGED once the initial snapshot arrives", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full(stringConfig("greeting", "Hello")) }]]);

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
      await commands.mswUseSseHandler(SSE_URL, [
        [
          { data: full(stringConfig("greeting", "Hello")) },
          { data: delta(stringConfig("greeting", "Updated")) },
        ],
      ]);

      const client = OpenFeature.getClient();
      const flagsChanged: (readonly string[] | undefined)[] = [];
      client.addHandler(ProviderEvents.ConfigurationChanged, (details: unknown) =>
        flagsChanged.push((details as { flagsChanged?: string[] } | undefined)?.flagsChanged),
      );

      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      expect(flagsChanged).toEqual([["greeting"], ["greeting"]]);
      expect(client.getStringValue("greeting", "default")).toBe("Updated");
    });

    test("onContextChange notifies the OpenFeature client of PROVIDER_STALE before the reconciled PROVIDER_CONFIGURATION_CHANGED and PROVIDER_READY", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [{ data: full(stringConfig("greeting", "Hello")) }],
        [{ data: full(stringConfig("greeting", "Bye")) }],
      ]);

      const client = OpenFeature.getClient();
      const order: string[] = [];
      const staleEvents: unknown[] = [];
      client.addHandler(ProviderEvents.Stale, (details: unknown) => {
        staleEvents.push(details);
        order.push("stale");
      });
      client.addHandler(ProviderEvents.ConfigurationChanged, () => order.push("configurationChanged"));
      client.addHandler(ProviderEvents.Ready, () => order.push("ready"));

      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
      order.length = 0;
      staleEvents.length = 0;

      await OpenFeature.setContext({ targetingKey: "user-1" });

      expect(staleEvents).toMatchObject([{ message: "Context Changed" }]);
      expect(order).toEqual(["stale", "configurationChanged", "ready"]);
      expect(client.getStringValue("greeting", "default")).toBe("Bye");
    });
  });
});
