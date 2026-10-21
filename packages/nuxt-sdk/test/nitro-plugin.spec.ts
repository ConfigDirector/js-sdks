import { describe, test, expect, vi, beforeEach } from "vitest";
import type { NitroApp } from "nitropack";
import plugin from "../src/runtime/nitro/plugin";
import { ConfigDirectorInitializationError } from "@shared/errors";

const { runtimeConfig, clientConstructor, initialize, loggedErrors } = vi.hoisted(() => ({
  runtimeConfig: {
    configdirector: {} as Record<string, unknown>,
    public: { configdirector: {} as Record<string, unknown> },
  },
  clientConstructor: vi.fn(),
  initialize: vi.fn(),
  loggedErrors: [] as unknown[][],
}));

vi.mock("../src/runtime/logger", () => ({
  createDefaultLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (...args: unknown[]) => {
      loggedErrors.push(args);
    },
  }),
}));

vi.mock("nitropack/runtime", () => ({
  defineNitroPlugin: (nitroPlugin: unknown) => nitroPlugin,
  useRuntimeConfig: () => runtimeConfig,
}));

vi.mock("@js-server-sdk/DefaultConfigDirectorClient", () => ({
  DefaultConfigDirectorClient: class {
    constructor(...args: unknown[]) {
      clientConstructor(...args);
    }

    initialize = initialize;
  },
}));

const runPlugin = (configdirector: Record<string, unknown>): NitroApp => {
  runtimeConfig.configdirector = configdirector;
  const nitroApp = { hooks: { hook: vi.fn() } } as unknown as NitroApp;
  plugin(nitroApp);
  return nitroApp;
};

const runRequestHook = (nitroApp: NitroApp): void => {
  const hook = nitroApp.hooks.hook as unknown as ReturnType<typeof vi.fn>;
  const [hookName, onRequest] = hook.mock.calls[0] as [string, (event: unknown) => void];
  expect(hookName).toBe("request");
  onRequest({ context: {} });
};

const clientOptions = () => clientConstructor.mock.calls[0]![2] as { connection: Record<string, unknown> };

describe("ConfigDirector Nitro plugin", () => {
  beforeEach(() => {
    clientConstructor.mockReset();
    initialize.mockReset();
    initialize.mockResolvedValue(undefined);
    loggedErrors.length = 0;
    runtimeConfig.public.configdirector = {};
  });

  test("passes the configured connection options through to the server client", () => {
    runPlugin({
      serverSdkKey: "server-key",
      baseUrl: "http://proxy.test",
      connection: { mode: "polling", pollingInterval: 120, timeout: 8_000 },
    });

    expect(clientConstructor).toHaveBeenCalledWith(
      "server-key",
      { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
      expect.objectContaining({
        connection: { url: "http://proxy.test", mode: "polling", pollingInterval: 120, timeout: 8_000 },
      }),
    );
  });

  test("leaves unset connection options undefined so the server SDK defaults apply", () => {
    runPlugin({
      serverSdkKey: "server-key",
      baseUrl: "",
      connection: { mode: "streaming", pollingInterval: 0, timeout: 0 },
    });

    expect(clientOptions().connection).toEqual({ mode: "streaming" });
  });

  test("builds an offline server client from the configured file without a server SDK key", () => {
    runPlugin({
      serverSdkKey: "",
      baseUrl: "",
      connection: { mode: "offline", file: "./flags/cell.json", pollingInterval: 0, timeout: 0 },
    });

    expect(clientConstructor).toHaveBeenCalledWith(
      undefined,
      { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
      expect.objectContaining({ connection: { mode: "offline", file: "./flags/cell.json" } }),
    );
  });

  test("builds an offline server client from the configured values without a server SDK key", () => {
    runPlugin({
      serverSdkKey: "",
      baseUrl: "",
      connection: { mode: "offline", file: "", values: { "new-checkout": true, "max-items": 20 } },
    });

    expect(clientConstructor).toHaveBeenCalledWith(
      undefined,
      { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
      expect.objectContaining({ connection: { mode: "offline", values: { "new-checkout": true, "max-items": 20 } } }),
    );
  });

  test("records the offline connection mode the server half runs in on the nitro app", () => {
    const nitroApp = runPlugin({ serverSdkKey: "", baseUrl: "", connection: { mode: "offline" } });

    expect(nitroApp.configDirectorConnectionMode).toBe("offline");
  });

  test("records streaming as the connection mode when none is configured", () => {
    const nitroApp = runPlugin({ serverSdkKey: "server-key", baseUrl: "" });

    expect(nitroApp.configDirectorConnectionMode).toBe("streaming");
  });

  test("writes the server's connection mode into each request's public runtime config", () => {
    const nitroApp = runPlugin({ serverSdkKey: "", baseUrl: "", connection: { mode: "offline" } });

    runRequestHook(nitroApp);

    expect(runtimeConfig.public.configdirector.serverConnectionMode).toBe("offline");
  });

  test("throws when the server SDK key is missing outside offline mode", () => {
    expect(() => runPlugin({ serverSdkKey: "", baseUrl: "", connection: { mode: "polling" } })).toThrow(
      ConfigDirectorInitializationError,
    );
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  test("logs a rejected initialization so a misconfigured offline source shows in the server output", async () => {
    const error = new ConfigDirectorInitializationError("The offline values file './flags/typo.json' could not be read");
    initialize.mockRejectedValue(error);

    const nitroApp = runPlugin({ serverSdkKey: "", baseUrl: "", connection: { mode: "offline", file: "./flags/typo.json" } });

    await expect(nitroApp.configDirectorInitialization).rejects.toBe(error);
    expect(loggedErrors).toEqual([[expect.any(String), error]]);
  });

  test("exposes the client and its initialization promise on the nitro app", () => {
    const initialization = Promise.resolve();
    initialize.mockReturnValue(initialization);

    const nitroApp = runPlugin({ serverSdkKey: "server-key", baseUrl: "" });

    expect(initialize).toHaveBeenCalledOnce();
    expect(nitroApp.configDirectorInitialization).toBe(initialization);
    expect(nitroApp.configDirectorClient).toBeDefined();
  });
});
