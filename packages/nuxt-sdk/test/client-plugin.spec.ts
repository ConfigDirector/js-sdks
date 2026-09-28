import { describe, test, expect, vi, beforeEach } from "vitest";
import type { NuxtApp } from "#app";
import plugin from "../src/runtime/plugin.client";

const { runtimeConfig, createBrowserClient, initialize } = vi.hoisted(() => ({
  runtimeConfig: { public: { configdirector: {} as Record<string, unknown> } },
  createBrowserClient: vi.fn(),
  initialize: vi.fn(),
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
  useConfigDirectorContext: () => ({ context: { value: undefined } }),
}));

const runPlugin = (configdirector: Record<string, unknown>) => {
  runtimeConfig.public.configdirector = configdirector;
  const nuxtApp = { hooks: { hook: vi.fn() } } as unknown as NuxtApp;
  return (plugin as unknown as (nuxtApp: NuxtApp) => unknown)(nuxtApp);
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
    const provided = runPlugin({ clientSdkKey: "client-key", baseUrl: "" }) as {
      provide: { configDirectorClient: unknown; configDirectorClientReadyStatus: { value: string } };
    };

    expect(provided.provide.configDirectorClient).toBeDefined();
    expect(provided.provide.configDirectorClientReadyStatus.value).toBe("loading");
  });
});
