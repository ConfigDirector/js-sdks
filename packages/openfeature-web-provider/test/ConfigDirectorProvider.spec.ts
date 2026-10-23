import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import { OpenFeature, ProviderEvents, ProviderNotReadyError, ProviderStatus } from "@openfeature/web-sdk";
import { ConfigDirectorProvider } from "../src";
import { SSE_URL, POLL_URL, createCapturingLogger, createStubbedLogger, deferred, forgetCachedValues } from "./helpers";

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

const CACHED_VALUES_STORAGE_KEY =
  "configdirector-sdk:cached-values:cc677751b8441e282621773a9be4622b11cd5bcffce54caabdd19f60e07d556c";

// These tests exercise ConfigDirectorProvider the way a real consumer would: registered with the
// OpenFeature web SDK and evaluated through an OpenFeature client, with the ConfigDirector SDK
// server stubbed out via msw.
describe("ConfigDirectorProvider (via @openfeature/web-sdk)", () => {
  beforeAll(async () => {
    await commands.mswSetup();
  });

  beforeEach(forgetCachedValues);

  afterEach(async () => {
    await OpenFeature.clearProviders();
    await OpenFeature.clearContexts();
    OpenFeature.clearHandlers();
    await OpenFeature.close();
    forgetCachedValues();
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

  test("serves offline values to OpenFeature evaluations without a client SDK key or a request", async () => {
    await commands.mswUseHandlers({ url: SSE_URL }, { url: POLL_URL });

    await OpenFeature.setProviderAndWait(
      new ConfigDirectorProvider({
        logger,
        metadata: { appName: "offline-app" },
        connection: { mode: "offline", values: { "show-banner": true, greeting: "Bye", "max-items": 42 } },
      }),
      { targetingKey: "offline-user-123" },
    );
    const client = OpenFeature.getClient();

    expect(client.getBooleanValue("show-banner", false)).toBe(true);
    expect(client.getStringValue("greeting", "Hello")).toBe("Bye");
    expect(client.getNumberValue("max-items", 0)).toBe(42);
    await OpenFeature.clearProviders();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(JSON.stringify(await commands.mswGetPayloads())).not.toMatch(/offline-(app|user)/);
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

  describe("context kinds", () => {
    const givenContexts = async () =>
      ((await commands.mswGetPayloads()) as { givenContext: unknown }[]).map((payload) => payload.givenContext);

    test("maps a top-level kind onto the ConfigDirector context kind on initialization", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }), {
        targetingKey: "42",
        kind: "device",
      });

      expect(await givenContexts()).toEqual([{ id: "42", kind: "device" }]);
    });

    test("maps a top-level kind onto the ConfigDirector context kind when the context changes", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }], [{ data: full() }]]);
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      await OpenFeature.setContext({ targetingKey: "42", kind: "tenant" });

      expect(await givenContexts()).toEqual([{}, { id: "42", kind: "tenant" }]);
    });

    test("keeps a kind inside traits as an ordinary trait", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }), {
        targetingKey: "42",
        traits: { kind: "device" },
      });

      expect(await givenContexts()).toEqual([{ id: "42", traits: { kind: "device" } }]);
    });

    test("initializes successfully with an invalid kind, connecting with no context and logging an error", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full(stringConfig("greeting", "hello everyone")) }]]);
      const capturingLogger = createCapturingLogger();

      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger: capturingLogger }), {
        targetingKey: "42",
        kind: "Tenant",
      });

      const client = OpenFeature.getClient();
      expect(client.providerStatus).toBe(ProviderStatus.READY);
      expect(client.getStringDetails("greeting", "in-code default")).toMatchObject({ value: "hello everyone" });
      expect(client.getStringDetails("greeting", "in-code default").errorCode).toBeUndefined();
      expect(await givenContexts()).toEqual([{}]);
      expect(capturingLogger.error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("'Tenant'"));
    });

    test("changes the context successfully with a top-level kind that is not text, connecting with no context", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [{ data: full(stringConfig("greeting", "hello 42")) }],
        [{ data: full(stringConfig("greeting", "hello everyone")) }],
      ]);
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }), { targetingKey: "42" });
      const client = OpenFeature.getClient();
      expect(client.getStringValue("greeting", "in-code default")).toBe("hello 42");

      await OpenFeature.setContext({ targetingKey: "42", kind: 42 });

      expect(client.providerStatus).toBe(ProviderStatus.READY);
      expect(client.getStringValue("greeting", "in-code default")).toBe("hello everyone");
      expect(await givenContexts()).toEqual([{ id: "42" }, {}]);
    });
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

    test("lists a flag removed by a full config push in PROVIDER_CONFIGURATION_CHANGED", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          { data: full({ ...stringConfig("greeting", "Hello"), ...stringConfig("farewell", "Bye") }) },
          { delay: 10, data: full(stringConfig("greeting", "Hello")) },
        ],
      ]);

      const client = OpenFeature.getClient();
      const flagsChanged: (readonly string[] | undefined)[] = [];
      client.addHandler(ProviderEvents.ConfigurationChanged, (details: unknown) =>
        flagsChanged.push((details as { flagsChanged?: string[] } | undefined)?.flagsChanged),
      );

      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));

      await vi.waitFor(() => expect(flagsChanged).toHaveLength(2), { timeout: 2_000 });
      expect(flagsChanged[1]).toEqual(["greeting", "farewell"]);
      expect(client.getStringValue("farewell", "default")).toBe("default");
    });

    test("onContextChange puts the OpenFeature client in PROVIDER_RECONCILING, never PROVIDER_STALE, before the reconciled PROVIDER_CONFIGURATION_CHANGED and PROVIDER_CONTEXT_CHANGED", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [{ data: full(stringConfig("greeting", "Hello")) }],
        [{ data: full(stringConfig("greeting", "Bye")) }],
      ]);

      const client = OpenFeature.getClient();
      const order: string[] = [];
      const statuses: string[] = [];
      client.addHandler(ProviderEvents.Stale, () => order.push("stale"));
      client.addHandler(ProviderEvents.Reconciling, () => {
        statuses.push(client.providerStatus);
        order.push("reconciling");
      });
      client.addHandler(ProviderEvents.ConfigurationChanged, () => order.push("configurationChanged"));
      client.addHandler(ProviderEvents.ContextChanged, () => order.push("contextChanged"));
      client.addHandler(ProviderEvents.Ready, () => order.push("ready"));

      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
      order.length = 0;

      await OpenFeature.setContext({ targetingKey: "user-1" });

      expect(statuses).toEqual([ProviderStatus.RECONCILING]);
      expect(order).toEqual(["reconciling", "configurationChanged", "contextChanged"]);
      expect(client.providerStatus).toBe(ProviderStatus.READY);
      expect(client.getStringValue("greeting", "default")).toBe("Bye");
    });
  });

  describe("when ConfigDirector does not become ready in time", () => {
    test("rejects registration with PROVIDER_NOT_READY, serves defaults, and reports ready once config state arrives", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ delay: 400, data: full(boolConfig("dark-mode", true)) }]]);

      const client = OpenFeature.getClient();
      const errorEvents: unknown[] = [];
      client.addHandler(ProviderEvents.Error, (details: unknown) => errorEvents.push(details));

      await expect(
        OpenFeature.setProviderAndWait(
          new ConfigDirectorProvider("sdk-key", { logger, connection: { timeout: 100 } }),
        ),
      ).rejects.toThrow(ProviderNotReadyError);

      expect(client.providerStatus).toBe(ProviderStatus.ERROR);
      expect(errorEvents).toHaveLength(1);
      expect(client.getBooleanValue("dark-mode", false)).toBe(false);

      const readyEvents: unknown[] = [];
      client.addHandler(ProviderEvents.Ready, (details: unknown) => readyEvents.push(details));

      await vi.waitFor(() => expect(client.providerStatus).toBe(ProviderStatus.READY), { timeout: 2_000 });

      expect(readyEvents).toHaveLength(1);
      expect(client.getBooleanValue("dark-mode", false)).toBe(true);
    });

    test("reports an error after a context change, keeps the previous context's values, and recovers", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [{ data: full(stringConfig("greeting", "Hello")) }],
        [{ delay: 400, data: full(stringConfig("greeting", "Bye")) }],
      ]);

      await OpenFeature.setProviderAndWait(
        new ConfigDirectorProvider("sdk-key", { logger, connection: { timeout: 100 } }),
      );
      const client = OpenFeature.getClient();
      const errorEvents: unknown[] = [];
      client.addHandler(ProviderEvents.Error, (details: unknown) => errorEvents.push(details));

      await OpenFeature.setContext({ targetingKey: "user-1" });

      expect(client.providerStatus).toBe(ProviderStatus.ERROR);
      expect(errorEvents).toHaveLength(1);
      expect(client.getStringValue("greeting", "default")).toBe("Hello");

      await vi.waitFor(() => expect(client.providerStatus).toBe(ProviderStatus.READY), { timeout: 2_000 });

      expect(client.getStringValue("greeting", "default")).toBe("Bye");
    });
  });

  describe("with values kept on the device", () => {
    test("reports the stale status and serves the device's values after a timeout, then ready once live values arrive", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full(boolConfig("dark-mode", true)) }]]);
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
      await vi.waitFor(() => expect(localStorage.getItem(CACHED_VALUES_STORAGE_KEY)).not.toBeNull());
      await OpenFeature.clearProviders();
      await commands.mswUseSseHandler(SSE_URL, [[{ delay: 400, data: full(boolConfig("dark-mode", false)) }]]);
      const client = OpenFeature.getClient();
      const statusEvents: string[] = [];
      client.addHandler(ProviderEvents.Error, () => statusEvents.push("error"));
      client.addHandler(ProviderEvents.Stale, () => statusEvents.push("stale"));
      client.addHandler(ProviderEvents.Ready, () => statusEvents.push("ready"));

      await expect(
        OpenFeature.setProviderAndWait(
          new ConfigDirectorProvider("sdk-key", { logger, connection: { timeout: 100 } }),
        ),
      ).rejects.toThrow(ProviderNotReadyError);

      await vi.waitFor(() => expect(client.providerStatus).toBe(ProviderStatus.STALE));
      expect(client.getBooleanValue("dark-mode", false)).toBe(true);

      await vi.waitFor(() => expect(client.providerStatus).toBe(ProviderStatus.READY), { timeout: 2_000 });

      expect(client.getBooleanValue("dark-mode", true)).toBe(false);
      expect(statusEvents).toEqual(["error", "stale", "ready"]);
    });

    test("reports the stale status when a slow provider delivers the device's values after the timeout", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full(boolConfig("dark-mode", true)) }]]);
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
      await vi.waitFor(() => expect(localStorage.getItem(CACHED_VALUES_STORAGE_KEY)).not.toBeNull());
      await OpenFeature.clearProviders();
      await commands.mswUseHandlers({ url: SSE_URL, status: 503 });
      const storedEntryRead = deferred<string | null>();
      const slowProvider = {
        read: () => storedEntryRead.promise,
        write: () => {},
        remove: () => {},
        sizeLimit: () => 256 * 1024,
      };
      const client = OpenFeature.getClient();
      await expect(
        OpenFeature.setProviderAndWait(
          new ConfigDirectorProvider("sdk-key", {
            logger,
            connection: { timeout: 100 },
            caching: { provider: slowProvider },
          }),
        ),
      ).rejects.toThrow(ProviderNotReadyError);
      expect(client.providerStatus).toBe(ProviderStatus.ERROR);
      expect(client.getBooleanValue("dark-mode", false)).toBe(false);

      storedEntryRead.resolve(localStorage.getItem(CACHED_VALUES_STORAGE_KEY));

      await vi.waitFor(() => expect(client.providerStatus).toBe(ProviderStatus.STALE));
      expect(client.getBooleanValue("dark-mode", false)).toBe(true);
    });

    test("reports the stale status again when a context change cannot connect", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full(boolConfig("dark-mode", true)) }]]);
      await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("sdk-key", { logger }));
      await vi.waitFor(() => expect(localStorage.getItem(CACHED_VALUES_STORAGE_KEY)).not.toBeNull());
      await OpenFeature.clearProviders();
      await commands.mswUseHandlers({ url: SSE_URL, status: 503 });
      const client = OpenFeature.getClient();
      await expect(
        OpenFeature.setProviderAndWait(
          new ConfigDirectorProvider("sdk-key", { logger, connection: { timeout: 100 } }),
        ),
      ).rejects.toThrow(ProviderNotReadyError);
      await vi.waitFor(() => expect(client.providerStatus).toBe(ProviderStatus.STALE));

      await OpenFeature.setContext({ targetingKey: "user-1" });

      expect(client.providerStatus).toBe(ProviderStatus.ERROR);
      await vi.waitFor(() => expect(client.providerStatus).toBe(ProviderStatus.STALE));
      expect(client.getBooleanValue("dark-mode", false)).toBe(true);
    });
  });
});
