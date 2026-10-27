import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { NuxtApp } from "#app";
import type { ConfigDirectorClient, ConfigDirectorContext } from "@js-client-core/types";
import plugin from "../src/runtime/plugin.server";
import { createTestClient } from "@js-server-sdk/testing/TestClient";
import type { TestClient } from "@js-server-sdk/testing/TestClient";

const { appContext } = vi.hoisted(() => ({
  appContext: { value: undefined as ConfigDirectorContext | undefined },
}));

vi.mock("#app", () => ({
  defineNuxtPlugin: (nuxtPlugin: unknown) => nuxtPlugin,
  useRuntimeConfig: () => ({ configdirector: { logLevel: "off" } }),
}));

vi.mock("../src/runtime/app/composables/useConfigDirectorContext", () => ({
  useConfigDirectorContext: () => ({ context: appContext }),
}));

type ProvidedByPlugin = {
  provide: { configDirectorClient: ConfigDirectorClient };
};

describe("ConfigDirector SSR plugin", () => {
  let serverTestClient: TestClient;
  let serverLoggedErrors: unknown[][];

  beforeEach(async () => {
    serverLoggedErrors = [];
    serverTestClient = createTestClient(
      { sdkName: "nuxt-sdk", sdkVersion: "0.0.0" },
      {
        values: { "welcome-message": "Hello from the server" },
        logger: {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: (...args: unknown[]) => {
            serverLoggedErrors.push(args);
          },
        },
      },
    );
    await serverTestClient.client.initialize();
  });

  afterEach(() => {
    serverTestClient.client.dispose();
  });

  const runPluginThroughAppCreated = async (): Promise<ConfigDirectorClient> => {
    const nuxtApp = {
      hooks: { hook: vi.fn() },
      ssrContext: { event: { context: { configDirectorClient: serverTestClient.client } } },
    } as unknown as NuxtApp;
    const provided = (plugin as unknown as (nuxtApp: NuxtApp) => ProvidedByPlugin)(nuxtApp);
    const [hookName, onAppCreated] = (nuxtApp.hooks.hook as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, () => Promise<void>];
    expect(hookName).toBe("app:created");
    await onAppCreated();
    return provided.provide.configDirectorClient;
  };

  test("shows the app context as the SSR client's context", async () => {
    appContext.value = { id: "42", kind: "device" };

    const client = await runPluginThroughAppCreated();

    expect(client.context).toEqual({ id: "42", kind: "device" });
  });

  test("shows no context on the SSR client when the app context has an invalid kind", async () => {
    appContext.value = { id: "42", kind: "Device" };

    const client = await runPluginThroughAppCreated();

    expect(client.context).toBeUndefined();
  });

  test("hands the app context to the server client, which logs its invalid kind when a value is read", async () => {
    appContext.value = { id: "42", kind: "Device" };
    const client = await runPluginThroughAppCreated();

    client.getValue("welcome-message", "fallback");

    expect(serverLoggedErrors).toEqual([[expect.stringContaining("'Device'")]]);
  });

  test("returns the server client's evaluation for the app context", async () => {
    appContext.value = { id: "42", kind: "device" };
    const client = await runPluginThroughAppCreated();

    const evaluation = client.evaluate("welcome-message", "fallback");

    expect(evaluation).toEqual({
      key: "welcome-message",
      value: "Hello from the server",
      valueId: undefined,
      isDefaultValue: false,
      reason: "found-match",
      context: { id: "42", kind: "device" },
    });
  });
});
