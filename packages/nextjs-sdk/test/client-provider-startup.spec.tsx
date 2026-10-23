// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfigDirectorProvider, useConfigDirectorStatus, useContext } from "../src/client";
import type { ConfigDirectorContext } from "../src/client";
import { createTestClient, installTestClient } from "../src/client/testing";
import type { TestClient } from "../src/client/testing";

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const letPendingWorkRun = () => new Promise((resolve) => setTimeout(resolve, 100));

const Status = () => {
  const { readyStatus } = useConfigDirectorStatus();
  return <span data-testid="status">{readyStatus}</span>;
};

const UpdatesContextOnMount = ({ context }: { context: ConfigDirectorContext }) => {
  const { updateContext } = useContext();
  useEffect(() => {
    void updateContext(context);
  }, [updateContext, context]);
  return <Status />;
};

const UpdatesContextOnClick = ({ context }: { context: ConfigDirectorContext }) => {
  const { updateContext } = useContext();
  return (
    <>
      <Status />
      <button data-testid="update-context" onClick={() => void updateContext(context)} />
    </>
  );
};

describe("client ConfigDirectorProvider startup", () => {
  const testClients: TestClient[] = [];
  const uninstallers: (() => void)[] = [];
  const installTestClientWithValues = (values: Record<string, string>) => {
    const testClient = createTestClient({ logger, values });
    testClients.push(testClient);
    uninstallers.push(installTestClient(testClient));
    return testClient;
  };

  afterEach(() => {
    cleanup();
    uninstallers.splice(0).reverse().forEach((uninstall) => uninstall());
    testClients.splice(0).forEach((testClient) => testClient.client.dispose());
  });

  test("a mount-effect updateContext under a provider without a context opens one connection carrying that context", async () => {
    const testClient = installTestClientWithValues({ greeting: "hello" });

    render(
      <ConfigDirectorProvider sdkKey="dummy-key">
        <UpdatesContextOnMount context={{ id: "654321" }} />
      </ConfigDirectorProvider>,
    );

    await expect.poll(() => screen.getByTestId("status").textContent).toBe("ready");
    expect(testClient.contextUpdates).toEqual([{ id: "654321" }]);
  });

  test("a provider with a context prop and no effect opens one connection with the prop's context", async () => {
    const testClient = installTestClientWithValues({ greeting: "hello" });

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" context={{ id: "prop-user" }}>
        <Status />
      </ConfigDirectorProvider>,
    );

    await expect.poll(() => screen.getByTestId("status").textContent).toBe("ready");
    expect(testClient.contextUpdates).toEqual([{ id: "prop-user" }]);
  });

  test("updateContext from useContext keeps one identity across renders", async () => {
    installTestClientWithValues({ greeting: "hello" });
    const updateContextFunctions: unknown[] = [];
    const Probe = () => {
      const { updateContext } = useContext();
      updateContextFunctions.push(updateContext);
      return <Status />;
    };

    render(
      <ConfigDirectorProvider sdkKey="dummy-key">
        <Probe />
      </ConfigDirectorProvider>,
    );

    await expect.poll(() => screen.getByTestId("status").textContent).toBe("ready");
    expect(updateContextFunctions.length).toBeGreaterThanOrEqual(2);
    expect(new Set(updateContextFunctions).size).toBe(1);
  });

  test("an updateContext with the context the provider already has opens no new connection", async () => {
    const testClient = installTestClientWithValues({ greeting: "hello" });
    render(
      <ConfigDirectorProvider sdkKey="dummy-key" context={{ id: "user-a", traits: { plan: "pro" } }}>
        <UpdatesContextOnClick context={{ id: "user-a", traits: { plan: "pro" } }} />
      </ConfigDirectorProvider>,
    );
    await expect.poll(() => screen.getByTestId("status").textContent).toBe("ready");

    fireEvent.click(screen.getByTestId("update-context"));
    await letPendingWorkRun();

    expect(testClient.contextUpdates).toEqual([{ id: "user-a", traits: { plan: "pro" } }]);
    expect(screen.getByTestId("status").textContent).toBe("ready");
  });

  test("a context prop equal to the context given through updateContext opens no new connection", async () => {
    const testClient = installTestClientWithValues({ greeting: "hello" });
    const view = render(
      <ConfigDirectorProvider sdkKey="dummy-key">
        <UpdatesContextOnMount context={{ id: "654321" }} />
      </ConfigDirectorProvider>,
    );
    await expect.poll(() => screen.getByTestId("status").textContent).toBe("ready");

    view.rerender(
      <ConfigDirectorProvider sdkKey="dummy-key" context={{ id: "654321" }}>
        <UpdatesContextOnMount context={{ id: "654321" }} />
      </ConfigDirectorProvider>,
    );
    await letPendingWorkRun();

    expect(testClient.contextUpdates).toEqual([{ id: "654321" }]);
  });

  test("a changed updateContext after the client started opens a connection with the new context", async () => {
    const testClient = installTestClientWithValues({ greeting: "hello" });
    render(
      <ConfigDirectorProvider sdkKey="dummy-key" context={{ id: "user-a" }}>
        <UpdatesContextOnClick context={{ id: "user-b" }} />
      </ConfigDirectorProvider>,
    );
    await expect.poll(() => screen.getByTestId("status").textContent).toBe("ready");

    fireEvent.click(screen.getByTestId("update-context"));

    await expect.poll(() => testClient.contextUpdates).toEqual([{ id: "user-a" }, { id: "user-b" }]);
    await expect.poll(() => screen.getByTestId("status").textContent).toBe("ready");
  });

  describe("with deferInitialization on", () => {
    test("opens no connection and reports loading while no context is given, then one connection with the first context", async () => {
      const testClient = installTestClientWithValues({ greeting: "hello" });
      render(
        <ConfigDirectorProvider sdkKey="dummy-key" deferInitialization>
          <UpdatesContextOnClick context={{ id: "signed-in-user" }} />
        </ConfigDirectorProvider>,
      );
      await letPendingWorkRun();

      expect(testClient.contextUpdates).toEqual([]);
      expect(screen.getByTestId("status").textContent).toBe("loading");

      fireEvent.click(screen.getByTestId("update-context"));

      await expect.poll(() => screen.getByTestId("status").textContent).toBe("ready");
      expect(testClient.contextUpdates).toEqual([{ id: "signed-in-user" }]);
    });

    test("opens one connection at once with a context prop", async () => {
      const testClient = installTestClientWithValues({ greeting: "hello" });

      render(
        <ConfigDirectorProvider sdkKey="dummy-key" deferInitialization context={{ id: "prop-user" }}>
          <Status />
        </ConfigDirectorProvider>,
      );

      await expect.poll(() => screen.getByTestId("status").textContent).toBe("ready");
      expect(testClient.contextUpdates).toEqual([{ id: "prop-user" }]);
    });

    test("opens one connection with the context of a mount-effect updateContext", async () => {
      const testClient = installTestClientWithValues({ greeting: "hello" });

      render(
        <ConfigDirectorProvider sdkKey="dummy-key" deferInitialization>
          <UpdatesContextOnMount context={{ id: "654321" }} />
        </ConfigDirectorProvider>,
      );

      await expect.poll(() => screen.getByTestId("status").textContent).toBe("ready");
      expect(testClient.contextUpdates).toEqual([{ id: "654321" }]);
    });

    test("starts the waiting client through initialization, so the values kept on the device for the first context are served", async () => {
      const testClient = installTestClientWithValues({ greeting: "hello" });
      testClient.holdInitialization();
      render(
        <ConfigDirectorProvider sdkKey="dummy-key" deferInitialization>
          <UpdatesContextOnClick context={{ id: "signed-in-user" }} />
        </ConfigDirectorProvider>,
      );
      await letPendingWorkRun();

      fireEvent.click(screen.getByTestId("update-context"));
      await letPendingWorkRun();

      expect(testClient.client.isInitializing).toBe(true);
      expect(screen.getByTestId("status").textContent).toBe("loading");

      await act(async () => {
        testClient.completeInitialization();
        await letPendingWorkRun();
      });

      expect(screen.getByTestId("status").textContent).toBe("ready");
      expect(testClient.contextUpdates).toEqual([{ id: "signed-in-user" }]);
    });

    test("leaves a given client untouched until the first context initializes it", async () => {
      const testClient = createTestClient({ logger, values: { greeting: "hello" } });
      testClients.push(testClient);
      render(
        <ConfigDirectorProvider client={testClient.client} deferInitialization>
          <UpdatesContextOnClick context={{ id: "signed-in-user" }} />
        </ConfigDirectorProvider>,
      );
      await letPendingWorkRun();

      expect(testClient.client.isReady).toBe(false);
      expect(testClient.contextUpdates).toEqual([]);

      fireEvent.click(screen.getByTestId("update-context"));

      await expect.poll(() => screen.getByTestId("status").textContent).toBe("ready");
      expect(testClient.contextUpdates).toEqual([{ id: "signed-in-user" }]);
    });
  });
});
