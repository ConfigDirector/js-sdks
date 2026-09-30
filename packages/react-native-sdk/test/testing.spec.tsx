import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { AppState, Text } from "react-native";
import { ConfigDirectorProvider } from "../src/provider";
import { useConfigValue } from "../src/hooks";
import { createTestClient, installTestClient } from "../src/testing";
import type { TestClient } from "../src/testing";
import type { ConfigDirectorClient } from "../src";
import { createStubbedLogger } from "./helpers";

const logger = createStubbedLogger();

const handlerCount = (client: ConfigDirectorClient, event: string) =>
  ((client as any).eventEmitter.handlerMap.get(event) ?? []).length;

const Greeting = () => {
  const { value, readyStatus } = useConfigValue("greeting", "default");
  return (
    <>
      <Text testID="value">{value}</Text>
      <Text testID="status">{readyStatus}</Text>
    </>
  );
};

describe("@configdirector/react-native-sdk/testing", () => {
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

  afterEach(() => {
    uninstallers.splice(0).reverse().forEach((uninstall) => uninstall());
    testClients.splice(0).forEach((testClient) => testClient.client.dispose());
    jest.restoreAllMocks();
  });

  test("S16 the provider re-renders on setValue and removeValue", async () => {
    const testClient = create({ values: { greeting: "hello" } });

    const view = render(
      <ConfigDirectorProvider client={testClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await view.findByText("hello");

    act(() => testClient.setValue("greeting", "changed"));
    expect(view.getByTestId("value")).toHaveTextContent("changed");

    act(() => testClient.removeValue("greeting"));
    expect(view.getByTestId("value")).toHaveTextContent("default");
  });

  test("S18 an installed test client replaces the client a provider would build", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    const testClient = create({ values: { greeting: "installed" } });
    install(testClient);

    const view = render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await view.findByText("installed");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(testClient.client.isReady).toBe(true);
  });

  test("S19 a provider never disposes a given client", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    const ownListener = jest.fn();
    testClient.client.on("configsUpdated", ownListener);

    const first = render(
      <ConfigDirectorProvider client={testClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await first.findByText("hello");
    first.unmount();

    expect(testClient.client.isReady).toBe(true);
    const second = render(
      <ConfigDirectorProvider client={testClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    act(() => testClient.setValue("greeting", "still alive"));

    await second.findByText("still alive");
    expect(ownListener).toHaveBeenCalledWith({ keys: ["greeting"], removedKeys: [] });
    expect(testClient.contextUpdates).toEqual([{}]);
  });

  test("S20 uninstalling a test client restores the one installed before it", async () => {
    const firstClient = create({ values: { greeting: "first" } });
    const secondClient = create({ values: { greeting: "second" } });
    install(firstClient);
    const uninstallSecond = install(secondClient);
    uninstallSecond();

    const view = render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await view.findByText("first");
  });

  test("S29 an unmounted provider has removed every handler it registered", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    const clientReadyHook = jest.fn();
    const before = handlerCount(testClient.client, "configsUpdated");

    const view = render(
      <ConfigDirectorProvider client={testClient.client} hooks={{ clientReady: clientReadyHook }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await view.findByText("hello");
    expect(clientReadyHook).toHaveBeenCalledTimes(1);
    view.unmount();

    expect(handlerCount(testClient.client, "configsUpdated")).toBe(before);
    expect(handlerCount(testClient.client, "clientReady")).toBe(0);
  });

  test("S30 remounting with a deeply equal context does not update the context again", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    const context = { id: "user-a", traits: { plan: "pro" } };

    const first = render(
      <ConfigDirectorProvider client={testClient.client} context={context}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await first.findByText("hello");
    first.unmount();
    const second = render(
      <ConfigDirectorProvider client={testClient.client} context={{ id: "user-a", traits: { plan: "pro" } }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await second.findByText("hello");

    expect(testClient.contextUpdates).toEqual([context]);
  });

  test("S34 a provider given a ready client and a different context updates the context", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    await testClient.client.initialize({ id: "user-a" });

    const view = render(
      <ConfigDirectorProvider client={testClient.client} context={{ id: "user-b" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await waitFor(() => expect(testClient.contextUpdates).toEqual([{ id: "user-a" }, { id: "user-b" }]));
    await view.findByText("hello");
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

  test("S36 unmounting before a held initialize resolves removes the AppState and NetInfo subscriptions", async () => {
    const removeAppStateListener = jest.fn();
    const addEventListenerSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: removeAppStateListener } as any);
    addEventListenerSpy.mockClear();
    const netInfoUnsubscribe = jest.fn();
    const netInfoSubscribe = jest.fn(() => netInfoUnsubscribe);
    const testClient = create({ values: { greeting: "hello" } });
    testClient.holdInitialization();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigDirectorProvider client={testClient.client} netInfoSubscribe={netInfoSubscribe}>
        {children}
      </ConfigDirectorProvider>
    );

    const { unmount } = renderHook(() => useConfigValue("greeting", "default"), { wrapper });
    act(() => unmount());
    await act(async () => {
      testClient.completeInitialization();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
    expect(removeAppStateListener).toHaveBeenCalledTimes(1);
    expect(netInfoSubscribe).toHaveBeenCalledTimes(1);
    expect(netInfoUnsubscribe).toHaveBeenCalledTimes(1);
    expect(testClient.client.isReady).toBe(true);
  });

  test("a provider given an initializing client joins that attempt instead of starting another", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    testClient.holdInitialization();
    const initialization = testClient.client.initialize({ id: "user-a" });

    const view = render(
      <ConfigDirectorProvider client={testClient.client} context={{ id: "user-b" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    expect(view.getByTestId("status")).toHaveTextContent("loading");
    await act(async () => {
      testClient.completeInitialization();
      await initialization;
    });

    await view.findByText("hello");
    expect(view.getByTestId("status")).toHaveTextContent("ready");
    expect(testClient.contextUpdates).toEqual([{ id: "user-a" }]);
  });

  test("a later render with a deeply equal context does not update the context", async () => {
    const testClient = create({ values: { greeting: "hello" } });

    const view = render(
      <ConfigDirectorProvider client={testClient.client} context={{ id: "user-a" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await view.findByText("hello");
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

    await waitFor(() => expect(testClient.contextUpdates).toEqual([{ id: "user-a" }, { id: "user-b" }]));
  });

  test("a changed client prop is ignored with a warning until the provider remounts", async () => {
    const firstClient = create({ values: { greeting: "first" } });
    const secondClient = create({ values: { greeting: "second" } });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const view = render(
      <ConfigDirectorProvider client={firstClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await view.findByText("first");
    view.rerender(
      <ConfigDirectorProvider client={secondClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    expect(view.getByTestId("value")).toHaveTextContent("first");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("client prop"));
    expect(secondClient.contextUpdates).toEqual([]);
  });

  test("a failed initialize of a given client shows the default status", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    testClient.failInitialization();

    const view = render(
      <ConfigDirectorProvider client={testClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await waitFor(() => expect(view.getByTestId("status")).toHaveTextContent("default"));
    expect(view.getByTestId("value")).toHaveTextContent("default");
  });
});
