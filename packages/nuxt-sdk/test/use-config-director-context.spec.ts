import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { ConfigDirectorContext } from "@js-client-core/types";
import { useConfigDirectorContext } from "../src/runtime/app/composables/useConfigDirectorContext";
import { createTestClient } from "../src/testing";
import type { TestClient } from "../src/testing";

const { appContext, installedClient, startup } = vi.hoisted(() => ({
  appContext: { value: undefined as ConfigDirectorContext | undefined },
  installedClient: { value: undefined as unknown },
  startup: { waitsForFirstContext: false, start: vi.fn() },
}));

vi.mock("#app", () => ({
  useState: () => appContext,
  useNuxtApp: () => ({ $configDirectorClientStartup: startup }),
}));

vi.mock("../src/runtime/app/composables/useConfigDirectorClient", () => ({
  useConfigDirectorClient: () => ({ client: installedClient.value }),
}));

describe("useConfigDirectorContext", () => {
  let testClient: TestClient;

  beforeEach(() => {
    appContext.value = undefined;
    testClient = createTestClient({ values: {} });
    installedClient.value = testClient.client;
    startup.waitsForFirstContext = false;
    startup.start.mockReset();
    startup.start.mockImplementation((context: ConfigDirectorContext) => testClient.client.initialize(context));
  });

  afterEach(() => {
    testClient.client.dispose();
  });

  test("keeps a context with a valid kind as the app context and hands it to the client", async () => {
    await testClient.client.initialize();
    const { context, updateContext } = useConfigDirectorContext();

    await updateContext({ id: "42", kind: "device" });

    expect(context.value).toEqual({ id: "42", kind: "device" });
    expect(testClient.contextUpdates).toEqual([{}, { id: "42", kind: "device" }]);
  });

  test("shows no app context after updateContext with an invalid kind, which the client records as an empty context", async () => {
    await testClient.client.initialize();
    const { context, updateContext } = useConfigDirectorContext();
    await updateContext({ id: "42", kind: "device" });

    await updateContext({ id: "43", kind: "Device" });

    expect(context.value).toBeUndefined();
    expect(testClient.client.context).toBeUndefined();
    expect(testClient.contextUpdates).toEqual([{}, { id: "42", kind: "device" }, {}]);
  });

  test("updates the context of a client that does not wait for its first context, even before it started", async () => {
    const { updateContext } = useConfigDirectorContext();

    await updateContext({ id: "42" });

    expect(startup.start).not.toHaveBeenCalled();
    expect(testClient.contextUpdates).toEqual([{ id: "42" }]);
  });

  describe("with a client that waits for its first context", () => {
    beforeEach(() => {
      startup.waitsForFirstContext = true;
    });

    test("starts the client with the first context through the plugin's start", async () => {
      const { context, updateContext } = useConfigDirectorContext();

      await updateContext({ id: "42" });

      expect(startup.start).toHaveBeenCalledWith({ id: "42" });
      expect(context.value).toEqual({ id: "42" });
      expect(testClient.client.isReady).toBe(true);
      expect(testClient.contextUpdates).toEqual([{ id: "42" }]);
    });

    test("updates the context of a client that has already started", async () => {
      await testClient.client.initialize();
      const { updateContext } = useConfigDirectorContext();

      await updateContext({ id: "42" });

      expect(startup.start).not.toHaveBeenCalled();
      expect(testClient.contextUpdates).toEqual([{}, { id: "42" }]);
    });

    test("updates the context of a client that is still starting with its first context", async () => {
      testClient.holdInitialization();
      const { updateContext } = useConfigDirectorContext();
      void updateContext({ id: "42" });

      await updateContext({ id: "43" });

      expect(startup.start).toHaveBeenCalledTimes(1);
      expect(testClient.contextUpdates).toEqual([{ id: "42" }, { id: "43" }]);
    });
  });
});
