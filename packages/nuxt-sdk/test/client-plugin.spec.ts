import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { NuxtApp } from "#app";
import type { ConfigDirectorContext } from "@js-client-core/types";
import plugin from "../src/runtime/plugin.client";
import { createTestClient, installTestClient } from "../src/testing";
import type { TestClient } from "../src/testing";
import { OFFLINE_VALUES_ROUTE } from "../src/runtime/offline-values-route";
import { ConfigDirectorInitializationError } from "@shared/errors";

const { runtimeConfig, createBrowserClient, initialize, appContext, fetchFromApp } = vi.hoisted(() => ({
  runtimeConfig: { public: { configdirector: {} as Record<string, unknown> } },
  createBrowserClient: vi.fn(),
  initialize: vi.fn(),
  appContext: { value: undefined as ConfigDirectorContext | undefined },
  fetchFromApp: vi.fn(),
}));

vi.mock("#app", () => ({
  defineNuxtPlugin: (nuxtPlugin: unknown) => nuxtPlugin,
  useRuntimeConfig: () => runtimeConfig,
}));

vi.mock("@js-browser-client/index", () => ({
  createBrowserClient: (...args: unknown[]) => {
    createBrowserClient(...args);
    return { isReady: false, on: vi.fn(), initialize };
  },
}));

vi.mock("../src/runtime/app/composables/useConfigDirectorContext", () => ({
  useConfigDirectorContext: () => ({ context: appContext }),
}));

type ProvidedByPlugin = {
  provide: { configDirectorClient: unknown; configDirectorClientReadyStatus: { value: string } };
};

const createNuxtApp = () => ({ hooks: { hook: vi.fn() } }) as unknown as NuxtApp;

const runPlugin = (configdirector: Record<string, unknown>, nuxtApp = createNuxtApp()) => {
  runtimeConfig.public.configdirector = configdirector;
  return (plugin as unknown as (nuxtApp: NuxtApp) => Promise<unknown>)(nuxtApp);
};

const runAppCreatedHook = async (nuxtApp: NuxtApp): Promise<void> => {
  const hook = nuxtApp.hooks.hook as unknown as ReturnType<typeof vi.fn>;
  const [hookName, callback] = hook.mock.calls[0] as [string, () => Promise<void>];
  expect(hookName).toBe("app:created");
  await callback();
};

const clientOptions = () => createBrowserClient.mock.calls[0]![2] as { connection: Record<string, unknown> };

describe("ConfigDirector client plugin", () => {
  beforeEach(() => {
    createBrowserClient.mockReset();
    initialize.mockReset();
    initialize.mockResolvedValue(undefined);
    fetchFromApp.mockReset();
    vi.stubGlobal("$fetch", fetchFromApp);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("passes the configured connection options through to the browser client", async () => {
    await runPlugin({
      clientSdkKey: "client-key",
      baseUrl: "http://proxy.test",
      connection: { mode: "polling", pollingInterval: 120, timeout: 8_000 },
    });

    expect(createBrowserClient).toHaveBeenCalledWith(
      "client-key",
      { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
      expect.objectContaining({
        connection: { url: "http://proxy.test", mode: "polling", pollingInterval: 120, timeout: 8_000 },
      }),
    );
  });

  test("leaves unset connection options undefined and keeps the 2 second timeout default", async () => {
    await runPlugin({
      clientSdkKey: "client-key",
      baseUrl: "",
      connection: { mode: "streaming", pollingInterval: 0, timeout: 0 },
    });

    expect(clientOptions().connection).toEqual({ mode: "streaming", timeout: 2_000 });
  });

  test("applies the defaults when no connection config is present", async () => {
    await runPlugin({ clientSdkKey: "client-key", baseUrl: "" });

    expect(clientOptions().connection).toEqual({ timeout: 2_000 });
  });

  test("throws when the clientSdkKey is missing and the server half is live", async () => {
    await expect(runPlugin({ clientSdkKey: "", baseUrl: "", serverConnectionMode: "streaming" })).rejects.toThrow(
      ConfigDirectorInitializationError,
    );
    expect(createBrowserClient).not.toHaveBeenCalled();
    expect(fetchFromApp).not.toHaveBeenCalled();
  });

  test("builds an offline browser client from explicit public values without a clientSdkKey", async () => {
    await runPlugin({
      clientSdkKey: "",
      baseUrl: "",
      connection: { mode: "offline", values: { "new-checkout": true }, pollingInterval: 0, timeout: 0 },
      serverConnectionMode: "streaming",
    });

    expect(createBrowserClient).toHaveBeenCalledWith(
      undefined,
      { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
      expect.objectContaining({
        connection: { mode: "offline", values: { "new-checkout": true }, timeout: 2_000 },
      }),
    );
    expect(fetchFromApp).not.toHaveBeenCalled();
  });

  test("inherits the server's offline values from the module's route when given neither mode nor values", async () => {
    fetchFromApp.mockResolvedValue({ "welcome-message": "Hello from the offline cell!", "item-count": 3 });

    await runPlugin({
      clientSdkKey: "",
      baseUrl: "",
      connection: { mode: "", pollingInterval: 0, timeout: 0 },
      serverConnectionMode: "offline",
    });

    expect(fetchFromApp).toHaveBeenCalledWith(OFFLINE_VALUES_ROUTE);
    expect(createBrowserClient).toHaveBeenCalledWith(
      undefined,
      { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
      expect.objectContaining({
        connection: {
          mode: "offline",
          values: { "welcome-message": "Hello from the offline cell!", "item-count": 3 },
          timeout: 2_000,
        },
      }),
    );
  });

  test("serves explicit public values instead of the server's offline values", async () => {
    await runPlugin({
      clientSdkKey: "",
      baseUrl: "",
      connection: { mode: "offline", values: { "new-checkout": false }, pollingInterval: 0, timeout: 0 },
      serverConnectionMode: "offline",
    });

    expect(fetchFromApp).not.toHaveBeenCalled();
    expect(clientOptions().connection).toEqual({ mode: "offline", values: { "new-checkout": false }, timeout: 2_000 });
  });

  test("connects with its own key when the public mode is set while the server half is offline", async () => {
    await runPlugin({
      clientSdkKey: "client-key",
      baseUrl: "",
      connection: { mode: "streaming", pollingInterval: 0, timeout: 0 },
      serverConnectionMode: "offline",
    });

    expect(fetchFromApp).not.toHaveBeenCalled();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "client-key",
      { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
      expect.objectContaining({ connection: { mode: "streaming", timeout: 2_000 } }),
    );
  });

  test("fails with an initialization error when the server's offline values cannot be fetched", async () => {
    fetchFromApp.mockRejectedValue(new Error("404 Not Found"));

    await expect(
      runPlugin({ clientSdkKey: "", baseUrl: "", connection: { mode: "" }, serverConnectionMode: "offline" }),
    ).rejects.toThrow(ConfigDirectorInitializationError);
    expect(createBrowserClient).not.toHaveBeenCalled();
  });

  test("provides the client and its ready status", async () => {
    const provided = await runPlugin({ clientSdkKey: "client-key", baseUrl: "" }) as ProvidedByPlugin;

    expect(provided.provide.configDirectorClient).toBeDefined();
    expect(provided.provide.configDirectorClientReadyStatus.value).toBe("loading");
  });

  describe("with an installed test client", () => {
    let testClient: TestClient;
    let uninstallTestClient: () => void;

    beforeEach(() => {
      appContext.value = undefined;
      testClient = createTestClient({ values: { "welcome-message": "Hello from the test client" }, timeout: 50 });
      uninstallTestClient = installTestClient(testClient);
    });

    afterEach(() => {
      uninstallTestClient();
      testClient.client.dispose();
    });

    test("provides the installed client instead of building one, and needs no clientSdkKey", async () => {
      const provided = await runPlugin({ clientSdkKey: "", baseUrl: "" }) as ProvidedByPlugin;

      expect(createBrowserClient).not.toHaveBeenCalled();
      expect(provided.provide.configDirectorClient).toBe(testClient.client);
      expect(provided.provide.configDirectorClientReadyStatus.value).toBe("loading");
    });

    test("initializes the installed client with the app context when the app is created", async () => {
      appContext.value = { id: "user-1" };
      const nuxtApp = createNuxtApp();
      const provided = await runPlugin({ clientSdkKey: "", baseUrl: "" }, nuxtApp) as ProvidedByPlugin;

      await runAppCreatedHook(nuxtApp);

      expect(testClient.client.isReady).toBe(true);
      expect(testClient.client.getValue("welcome-message", "fallback")).toBe("Hello from the test client");
      expect(testClient.contextUpdates).toEqual([{ id: "user-1" }]);
      expect(provided.provide.configDirectorClientReadyStatus.value).toBe("ready");
    });

    test("initializes the installed client with no context when the app context has an invalid kind", async () => {
      appContext.value = { id: "42", kind: "Device" };
      const nuxtApp = createNuxtApp();
      await runPlugin({ clientSdkKey: "", baseUrl: "" }, nuxtApp);

      await runAppCreatedHook(nuxtApp);

      expect(testClient.client.isReady).toBe(true);
      expect(testClient.client.context).toBeUndefined();
      expect(testClient.contextUpdates).toEqual([{}]);
    });

    test("does not initialize an installed client that is already ready with the same context", async () => {
      appContext.value = { id: "user-1" };
      await testClient.client.initialize({ id: "user-1" });
      const nuxtApp = createNuxtApp();
      const provided = await runPlugin({ clientSdkKey: "", baseUrl: "" }, nuxtApp) as ProvidedByPlugin;

      expect(provided.provide.configDirectorClientReadyStatus.value).toBe("ready");
      await runAppCreatedHook(nuxtApp);

      expect(testClient.contextUpdates).toEqual([{ id: "user-1" }]);
    });

    test("updates the context of a ready installed client when the app context differs", async () => {
      appContext.value = { id: "user-2" };
      await testClient.client.initialize({ id: "user-1" });
      const initializeSpy = vi.spyOn(testClient.client, "initialize");
      const nuxtApp = createNuxtApp();
      await runPlugin({ clientSdkKey: "", baseUrl: "" }, nuxtApp);

      await runAppCreatedHook(nuxtApp);

      expect(initializeSpy).not.toHaveBeenCalled();
      expect(testClient.contextUpdates).toEqual([{ id: "user-1" }, { id: "user-2" }]);
    });

    test("reports the default status when the installed client's initialization times out", async () => {
      testClient.holdInitialization();
      const nuxtApp = createNuxtApp();
      const provided = await runPlugin({ clientSdkKey: "", baseUrl: "" }, nuxtApp) as ProvidedByPlugin;

      await runAppCreatedHook(nuxtApp);

      expect(testClient.client.isReady).toBe(false);
      expect(provided.provide.configDirectorClientReadyStatus.value).toBe("default");
    });
  });
});
