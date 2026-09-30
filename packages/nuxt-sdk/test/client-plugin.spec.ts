import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { NuxtApp } from "#app";
import type { ConfigDirectorContext } from "@js-client-core/types";
import plugin from "../src/runtime/plugin.client";
import { createTestClient, installTestClient } from "../src/testing";
import type { TestClient } from "../src/testing";

const { runtimeConfig, createBrowserClient, initialize, appContext } = vi.hoisted(() => ({
  runtimeConfig: { public: { configdirector: {} as Record<string, unknown> } },
  createBrowserClient: vi.fn(),
  initialize: vi.fn(),
  appContext: { value: undefined as ConfigDirectorContext | undefined },
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
  return (plugin as unknown as (nuxtApp: NuxtApp) => unknown)(nuxtApp);
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
  });

  test("passes the configured connection options through to the browser client", () => {
    runPlugin({
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

  test("leaves unset connection options undefined and keeps the 2 second timeout default", () => {
    runPlugin({
      clientSdkKey: "client-key",
      baseUrl: "",
      connection: { mode: "streaming", pollingInterval: 0, timeout: 0 },
    });

    expect(clientOptions().connection).toEqual({ mode: "streaming", timeout: 2_000 });
  });

  test("applies the defaults when no connection config is present", () => {
    runPlugin({ clientSdkKey: "client-key", baseUrl: "" });

    expect(clientOptions().connection).toEqual({ timeout: 2_000 });
  });

  test("provides the client and its ready status", () => {
    const provided = runPlugin({ clientSdkKey: "client-key", baseUrl: "" }) as ProvidedByPlugin;

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

    test("provides the installed client instead of building one, and needs no clientSdkKey", () => {
      const provided = runPlugin({ clientSdkKey: "", baseUrl: "" }) as ProvidedByPlugin;

      expect(createBrowserClient).not.toHaveBeenCalled();
      expect(provided.provide.configDirectorClient).toBe(testClient.client);
      expect(provided.provide.configDirectorClientReadyStatus.value).toBe("loading");
    });

    test("initializes the installed client with the app context when the app is created", async () => {
      appContext.value = { id: "user-1" };
      const nuxtApp = createNuxtApp();
      const provided = runPlugin({ clientSdkKey: "", baseUrl: "" }, nuxtApp) as ProvidedByPlugin;

      await runAppCreatedHook(nuxtApp);

      expect(testClient.client.isReady).toBe(true);
      expect(testClient.client.getValue("welcome-message", "fallback")).toBe("Hello from the test client");
      expect(testClient.contextUpdates).toEqual([{ id: "user-1" }]);
      expect(provided.provide.configDirectorClientReadyStatus.value).toBe("ready");
    });

    test("does not initialize an installed client that is already ready with the same context", async () => {
      appContext.value = { id: "user-1" };
      await testClient.client.initialize({ id: "user-1" });
      const nuxtApp = createNuxtApp();
      const provided = runPlugin({ clientSdkKey: "", baseUrl: "" }, nuxtApp) as ProvidedByPlugin;

      expect(provided.provide.configDirectorClientReadyStatus.value).toBe("ready");
      await runAppCreatedHook(nuxtApp);

      expect(testClient.contextUpdates).toEqual([{ id: "user-1" }]);
    });

    test("updates the context of a ready installed client when the app context differs", async () => {
      appContext.value = { id: "user-2" };
      await testClient.client.initialize({ id: "user-1" });
      const initializeSpy = vi.spyOn(testClient.client, "initialize");
      const nuxtApp = createNuxtApp();
      runPlugin({ clientSdkKey: "", baseUrl: "" }, nuxtApp);

      await runAppCreatedHook(nuxtApp);

      expect(initializeSpy).not.toHaveBeenCalled();
      expect(testClient.contextUpdates).toEqual([{ id: "user-1" }, { id: "user-2" }]);
    });

    test("reports the default status when the installed client's initialization times out", async () => {
      testClient.holdInitialization();
      const nuxtApp = createNuxtApp();
      const provided = runPlugin({ clientSdkKey: "", baseUrl: "" }, nuxtApp) as ProvidedByPlugin;

      await runAppCreatedHook(nuxtApp);

      expect(testClient.client.isReady).toBe(false);
      expect(provided.provide.configDirectorClientReadyStatus.value).toBe("default");
    });
  });
});
