import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import { act, render, screen } from "@testing-library/react";
import { ConfigDirectorProvider, useConfigValue, withProvider } from "../src";
import { createTestClient, installTestClient } from "../src/testing";
import type { TestClient } from "../src/testing";
import type { ConfigDirectorClient } from "../src";
import { SSE_URL, createStubbedLogger } from "./helpers";

const POLL_URL = "https://client-sdk-api.configdirector.com/client/polling/v1";
const TELEMETRY_URL = "https://client-sdk-api.configdirector.com/client/telemetry/v1";

const logger = createStubbedLogger();

const handlerCount = (client: ConfigDirectorClient, event: string) =>
  ((client as any).eventEmitter.handlerMap.get(event) ?? []).length;

const Greeting = () => {
  const { value, readyStatus } = useConfigValue("greeting", "default");
  return (
    <div>
      <span data-testid="value">{value}</span>
      <span data-testid="status">{readyStatus}</span>
    </div>
  );
};

describe("@configdirector/react-web-sdk/testing", () => {
  const testClients: TestClient[] = [];
  const uninstallers: (() => void)[] = [];
  const create = (...args: Parameters<typeof createTestClient>) => {
    const testClient = createTestClient({ logger, ...args[0] });
    testClients.push(testClient);
    return testClient;
  };
  const install = (testClient: TestClient) => {
    const uninstall = installTestClient(testClient);
    uninstallers.push(uninstall);
    return uninstall;
  };

  beforeAll(async () => {
    await commands.mswSetup();
  });
  afterEach(() => {
    uninstallers.splice(0).reverse().forEach((uninstall) => uninstall());
    testClients.splice(0).forEach((testClient) => testClient.client.dispose());
  });
  afterAll(async () => await commands.mswTeardown());

  test("S16 the provider re-renders on setValue and removeValue", async () => {
    const testClient = create({ values: { greeting: "hello" } });

    render(
      <ConfigDirectorProvider client={testClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    expect(await screen.findByText("hello")).toBeInTheDocument();

    act(() => testClient.setValue("greeting", "changed"));
    expect(screen.getByTestId("value")).toHaveTextContent("changed");

    act(() => testClient.removeValue("greeting"));
    expect(screen.getByTestId("value")).toHaveTextContent("default");
  });

  test("S18 an installed test client replaces the client a provider would build", async () => {
    await commands.mswUseHandlers({ url: SSE_URL }, { url: POLL_URL }, { url: TELEMETRY_URL });
    const testClient = create({ values: { greeting: "installed" } });
    install(testClient);

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    expect(await screen.findByText("installed")).toBeInTheDocument();
    expect(await commands.mswWasRequestReceived()).toBe(false);
    expect(testClient.client.isReady).toBe(true);
  });

  test("S19 a provider never disposes a given client", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    const ownListener = vi.fn();
    testClient.client.on("configsUpdated", ownListener);

    const view = render(
      <ConfigDirectorProvider client={testClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await screen.findByText("hello");
    view.unmount();

    expect(testClient.client.isReady).toBe(true);
    render(
      <ConfigDirectorProvider client={testClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    act(() => testClient.setValue("greeting", "still alive"));

    expect(await screen.findByText("still alive")).toBeInTheDocument();
    expect(ownListener).toHaveBeenCalledWith({ keys: ["greeting"], removedKeys: [] });
    expect(testClient.contextUpdates).toEqual([{}]);
  });

  test("S20 uninstalling a test client restores the one installed before it", async () => {
    const first = create({ values: { greeting: "first" } });
    const second = create({ values: { greeting: "second" } });
    install(first);
    const uninstallSecond = install(second);
    uninstallSecond();

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    expect(await screen.findByText("first")).toBeInTheDocument();
  });

  test("S29 an unmounted provider has removed every handler it registered", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    const clientReadyHook = vi.fn();
    const before = handlerCount(testClient.client, "configsUpdated");

    const view = render(
      <ConfigDirectorProvider client={testClient.client} hooks={{ clientReady: clientReadyHook }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await screen.findByText("hello");
    expect(clientReadyHook).toHaveBeenCalledOnce();
    view.unmount();

    expect(handlerCount(testClient.client, "configsUpdated")).toBe(before);
    expect(handlerCount(testClient.client, "clientReady")).toBe(0);
    testClient.setValue("greeting", "after unmount");
    expect(handlerCount(testClient.client, "configsUpdated")).toBe(before);
  });

  test("S30 remounting with a deeply equal context does not update the context again", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    const context = { id: "user-a", traits: { plan: "pro" } };

    const view = render(
      <ConfigDirectorProvider client={testClient.client} context={context}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await screen.findByText("hello");
    view.unmount();
    render(
      <ConfigDirectorProvider client={testClient.client} context={{ id: "user-a", traits: { plan: "pro" } }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await screen.findByText("hello");

    expect(testClient.contextUpdates).toEqual([context]);
  });

  test("S31 withProvider uses the installed test client", async () => {
    await commands.mswUseHandlers({ url: SSE_URL }, { url: POLL_URL }, { url: TELEMETRY_URL });
    const testClient = create({ values: { greeting: "wrapped" } });
    install(testClient);

    const Provider = await withProvider({ sdkKey: "dummy-key", logger });
    render(
      <Provider>
        <Greeting />
      </Provider>,
    );

    expect(await screen.findByText("wrapped")).toBeInTheDocument();
    expect(await commands.mswWasRequestReceived()).toBe(false);
  });

  test("S34 a provider given a ready client and a different context updates the context", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    await testClient.client.initialize({ id: "user-a" });

    render(
      <ConfigDirectorProvider client={testClient.client} context={{ id: "user-b" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(testClient.contextUpdates).toEqual([{ id: "user-a" }, { id: "user-b" }]));
    expect(await screen.findByText("hello")).toBeInTheDocument();
  });

  test("S35 a provider given a ready client reports ready on its first render", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    await testClient.client.initialize();
    const statuses: string[] = [];
    const StatusProbe = () => {
      statuses.push(useConfigValue("greeting", "default").readyStatus);
      return null;
    };

    render(
      <ConfigDirectorProvider client={testClient.client}>
        <StatusProbe />
      </ConfigDirectorProvider>,
    );

    expect(statuses[0]).toBe("ready");
    expect(testClient.contextUpdates).toEqual([{}]);
  });

  test("a provider given an initializing client joins that attempt instead of starting another", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    testClient.holdInitialization();
    const initialization = testClient.client.initialize({ id: "user-a" });

    render(
      <ConfigDirectorProvider client={testClient.client} context={{ id: "user-b" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    act(() => testClient.completeInitialization());
    await initialization;

    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(testClient.contextUpdates).toEqual([{ id: "user-a" }]);
  });

  test("a later render with a deeply equal context does not update the context", async () => {
    const testClient = create({ values: { greeting: "hello" } });

    const view = render(
      <ConfigDirectorProvider client={testClient.client} context={{ id: "user-a" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await screen.findByText("hello");
    view.rerender(
      <ConfigDirectorProvider client={testClient.client} context={{ id: "user-a" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    view.rerender(
      <ConfigDirectorProvider client={testClient.client} context={{ id: "user-b" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(testClient.contextUpdates).toEqual([{ id: "user-a" }, { id: "user-b" }]));
  });

  test("a changed client prop is ignored with a warning until the provider remounts", async () => {
    const first = create({ values: { greeting: "first" } });
    const second = create({ values: { greeting: "second" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const view = render(
      <ConfigDirectorProvider client={first.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await screen.findByText("first");
    view.rerender(
      <ConfigDirectorProvider client={second.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    expect(screen.getByTestId("value")).toHaveTextContent("first");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("client prop"));
    expect(second.contextUpdates).toEqual([]);
    warn.mockRestore();
  });

  test("a failed initialize of a given client shows the default status", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    testClient.failInitialization();

    render(
      <ConfigDirectorProvider client={testClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("default"));
    expect(screen.getByTestId("value")).toHaveTextContent("default");
  });
});
