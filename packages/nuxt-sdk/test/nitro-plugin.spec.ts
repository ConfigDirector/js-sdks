import { describe, test, expect, vi, beforeEach } from "vitest";
import type { NitroApp } from "nitropack";
import plugin from "../src/runtime/nitro/plugin";

const { runtimeConfig, clientConstructor, initialize } = vi.hoisted(() => ({
  runtimeConfig: { configdirector: {} as Record<string, unknown> },
  clientConstructor: vi.fn(),
  initialize: vi.fn(),
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
  const nitroApp = {} as NitroApp;
  plugin(nitroApp);
  return nitroApp;
};

const clientOptions = () => clientConstructor.mock.calls[0]![2] as { connection: Record<string, unknown> };

describe("ConfigDirector Nitro plugin", () => {
  beforeEach(() => {
    clientConstructor.mockReset();
    initialize.mockReset();
    initialize.mockResolvedValue(undefined);
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

  test("exposes the client and its initialization promise on the nitro app", () => {
    const initialization = Promise.resolve();
    initialize.mockReturnValue(initialization);

    const nitroApp = runPlugin({ serverSdkKey: "server-key", baseUrl: "" });

    expect(initialize).toHaveBeenCalledOnce();
    expect(nitroApp.configDirectorInitialization).toBe(initialization);
    expect(nitroApp.configDirectorClient).toBeDefined();
  });
});
