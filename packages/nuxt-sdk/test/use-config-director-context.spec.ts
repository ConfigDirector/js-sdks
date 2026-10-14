import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { ConfigDirectorContext } from "@js-client-core/types";
import { useConfigDirectorContext } from "../src/runtime/app/composables/useConfigDirectorContext";
import { createTestClient } from "../src/testing";
import type { TestClient } from "../src/testing";

const { appContext, installedClient } = vi.hoisted(() => ({
  appContext: { value: undefined as ConfigDirectorContext | undefined },
  installedClient: { value: undefined as unknown },
}));

vi.mock("#app", () => ({
  useState: () => appContext,
}));

vi.mock("../src/runtime/app/composables/useConfigDirectorClient", () => ({
  useConfigDirectorClient: () => ({ client: installedClient.value }),
}));

describe("useConfigDirectorContext", () => {
  let testClient: TestClient;

  beforeEach(async () => {
    appContext.value = undefined;
    testClient = createTestClient({ values: {} });
    installedClient.value = testClient.client;
    await testClient.client.initialize();
  });

  afterEach(() => {
    testClient.client.dispose();
  });

  test("keeps a context with a valid kind as the app context and hands it to the client", async () => {
    const { context, updateContext } = useConfigDirectorContext();

    await updateContext({ id: "42", kind: "device" });

    expect(context.value).toEqual({ id: "42", kind: "device" });
    expect(testClient.contextUpdates).toEqual([{}, { id: "42", kind: "device" }]);
  });

  test("shows no app context after updateContext with an invalid kind, which the client records as an empty context", async () => {
    const { context, updateContext } = useConfigDirectorContext();
    await updateContext({ id: "42", kind: "device" });

    await updateContext({ id: "43", kind: "Device" });

    expect(context.value).toBeUndefined();
    expect(testClient.client.context).toBeUndefined();
    expect(testClient.contextUpdates).toEqual([{}, { id: "42", kind: "device" }, {}]);
  });
});
