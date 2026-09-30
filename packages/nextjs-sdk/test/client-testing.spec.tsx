// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ConfigDirectorProvider, useClient, useConfigValue } from "../src/client";
import type { ConfigDirectorClient } from "../src/client";
import { createTestClient, installTestClient } from "../src/client/testing";
import type { TestClient } from "../src/client/testing";
import type { ConfigState } from "@shared/types";

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

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

const initialConfigs: Record<string, ConfigState> = {
  greeting: { id: "ssr:greeting", key: "greeting", type: "string", value: "from ssr" },
};

describe("@configdirector/nextjs-sdk/client/testing", () => {
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
    cleanup();
    uninstallers.splice(0).reverse().forEach((uninstall) => uninstall());
    testClients.splice(0).forEach((testClient) => testClient.client.dispose());
    vi.restoreAllMocks();
  });

  test("S16 the provider re-renders on setValue and removeValue", async () => {
    const testClient = create({ values: { greeting: "hello" } });

    render(
      <ConfigDirectorProvider client={testClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    expect(await screen.findByText("hello")).toBeDefined();

    act(() => testClient.setValue("greeting", "changed"));
    expect(screen.getByTestId("value").textContent).toBe("changed");

    act(() => testClient.removeValue("greeting"));
    expect(screen.getByTestId("value").textContent).toBe("default");
  });

  test("S18 an installed test client replaces the client a provider would build", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const testClient = create({ values: { greeting: "installed" } });
    install(testClient);

    render(
      <ConfigDirectorProvider sdkKey="dummy-key">
        <Greeting />
      </ConfigDirectorProvider>,
    );

    expect(await screen.findByText("installed")).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
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

    expect(await screen.findByText("still alive")).toBeDefined();
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
      <ConfigDirectorProvider sdkKey="dummy-key">
        <Greeting />
      </ConfigDirectorProvider>,
    );

    expect(await screen.findByText("first")).toBeDefined();
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

  test("S34 a provider given a ready client and a different context updates the context", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    await testClient.client.initialize({ id: "user-a" });

    render(
      <ConfigDirectorProvider client={testClient.client} context={{ id: "user-b" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(testClient.contextUpdates).toEqual([{ id: "user-a" }, { id: "user-b" }]));
    expect(await screen.findByText("hello")).toBeDefined();
  });

  test("S35 a provider given a ready client reports ready and serves its values on the first render", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    await testClient.client.initialize();
    const renders: { status: string; value: string; hasClient: boolean }[] = [];
    const Probe = () => {
      const { value, readyStatus } = useConfigValue("greeting", "default");
      const { client } = useClient();
      renders.push({ status: readyStatus, value, hasClient: client !== undefined });
      return null;
    };

    render(
      <ConfigDirectorProvider client={testClient.client}>
        <Probe />
      </ConfigDirectorProvider>,
    );

    expect(renders[0]).toEqual({ status: "ready", value: "hello", hasClient: true });
    expect(testClient.contextUpdates).toEqual([{}]);
  });

  test("initialConfigs are shown with a given client until it is ready", async () => {
    const testClient = create({ values: { greeting: "live" } });
    testClient.holdInitialization();

    render(
      <ConfigDirectorProvider client={testClient.client} initialConfigs={initialConfigs}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    expect(screen.getByTestId("value").textContent).toBe("from ssr");
    expect(screen.getByTestId("status").textContent).toBe("loading");

    await act(async () => {
      testClient.completeInitialization();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByText("live")).toBeDefined();
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
    expect(screen.getByTestId("status").textContent).toBe("loading");
    await act(async () => {
      testClient.completeInitialization();
      await initialization;
    });

    expect(await screen.findByText("hello")).toBeDefined();
    expect(screen.getByTestId("status").textContent).toBe("ready");
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

    expect(screen.getByTestId("value").textContent).toBe("first");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("client prop"));
    expect(second.contextUpdates).toEqual([]);
  });

  test("a failed initialize of a given client shows the default status", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    testClient.failInitialization();

    render(
      <ConfigDirectorProvider client={testClient.client}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(screen.getByTestId("status").textContent).toBe("default"));
    expect(screen.getByTestId("value").textContent).toBe("default");
  });
});
