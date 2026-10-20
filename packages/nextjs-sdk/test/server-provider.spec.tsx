import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ConfigDirectorProvider, register } from "../src/server";
import { createTestClient, installServerTestClient } from "../src/server/testing";

const offlineValues = {
  "new-checkout": true,
  "max-items": 20,
  ratio: 2.5,
  greeting: "hello",
  theme: { color: "blue", sizes: [1, 2] },
  tags: ["a", "b"],
};

describe("server ConfigDirectorProvider hand-over to the browser half", () => {
  const previousRuntime = process.env["NEXT_RUNTIME"];

  beforeEach(() => {
    process.env["NEXT_RUNTIME"] = "nodejs";
  });

  afterEach(() => {
    process.env["NEXT_RUNTIME"] = previousRuntime;
    globalThis.__configDirectorServerClient?.dispose();
    globalThis.__configDirectorServerClient = undefined;
    globalThis.__configDirectorServerConnectionMode = undefined;
    globalThis.__configDirectorAppMeta = undefined;
  });

  test("hands the server's offline values to the browser half as mode offline when given no mode or values", async () => {
    await register({ connection: { mode: "offline", values: offlineValues } });

    const element = await ConfigDirectorProvider({ children: null });

    expect(element.props.mode).toBe("offline");
    expect(element.props.values).toEqual(offlineValues);
    expect(element.props.initialConfigs).toMatchObject({
      "new-checkout": { key: "new-checkout", type: "boolean", value: "true" },
      theme: { key: "theme", type: "json", value: JSON.stringify({ color: "blue", sizes: [1, 2] }) },
    });
  });

  test("narrows the handed-over values by configKeys as it narrows initialConfigs", async () => {
    await register({ connection: { mode: "offline", values: offlineValues } });

    const element = await ConfigDirectorProvider({ configKeys: ["new-checkout", "greeting"], children: null });

    expect(element.props.values).toEqual({ "new-checkout": true, greeting: "hello" });
    expect(Object.keys(element.props.initialConfigs)).toEqual(["new-checkout", "greeting"]);
  });

  test("forwards explicit mode and values props unchanged instead of the server's offline values", async () => {
    await register({ connection: { mode: "offline", values: offlineValues } });

    const element = await ConfigDirectorProvider({
      mode: "offline",
      values: { "new-checkout": false },
      children: null,
    });

    expect(element.props.mode).toBe("offline");
    expect(element.props.values).toEqual({ "new-checkout": false });
  });

  test("forwards an explicit live mode unchanged while the server is offline", async () => {
    await register({ connection: { mode: "offline", values: offlineValues } });

    const element = await ConfigDirectorProvider({ sdkKey: "client-key", mode: "polling", children: null });

    expect(element.props.mode).toBe("polling");
    expect(element.props.values).toBeUndefined();
  });

  test("lets the browser half connect live when the server is not offline", async () => {
    const testClient = createTestClient({ values: { "new-checkout": true } });
    const uninstall = installServerTestClient(testClient);
    await testClient.client.initialize();

    const element = await ConfigDirectorProvider({ sdkKey: "client-key", children: null });

    expect(element.props.mode).toBeUndefined();
    expect(element.props.values).toBeUndefined();
    expect(element.props.sdkKey).toBe("client-key");
    expect(element.props.initialConfigs).toMatchObject({ "new-checkout": { value: "true" } });
    uninstall();
    testClient.client.dispose();
  });
});
