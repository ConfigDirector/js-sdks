import { afterEach, beforeEach, beforeAll, afterAll, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { AppState } from "react-native";
import { ConfigDirectorProvider } from "../src/provider";
import { useConfigValue } from "../src/hooks";
import { buildResponse, message, full, createStubbedLogger } from "./helpers";

const logger = createStubbedLogger();

import type { ConfigDirectorProviderOptions } from "../src/types";

const wrapper =
  (options: ConfigDirectorProviderOptions) =>
  ({ children }: { children: React.ReactNode }) => (
    <ConfigDirectorProvider logger={logger} {...options}>
      {children}
    </ConfigDirectorProvider>
  );

describe("ConfigDirectorProvider", () => {
  let fetchSpy: ReturnType<typeof jest.spyOn<typeof globalThis, "fetch", any>>;

  beforeAll(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  const mockFetchWith = (response: () => Promise<Response>) => {
    fetchSpy.mockImplementation(async (url) => {
      if ((url as string).toString().includes("telemetry")) {
        return Response.json({}, { status: 204 });
      } else {
        return await response();
      }
    });
  };

  it("renders without error", async () => {
    mockFetchWith(async () => buildResponse(new ReadableStream()));

    const { result, unmount } = renderHook(() => useConfigValue("key", "default"), {
      wrapper: wrapper({ sdkKey: "dummy-key" }),
    });

    await waitFor(() => expect(result.current.readyStatus).toBe("loading"));
    unmount();
  });

  it("sets status to 'default' when initialization times out", async () => {
    mockFetchWith(async () => buildResponse(new ReadableStream()));

    const { result, unmount } = renderHook(() => useConfigValue("key", "default-value"), {
      wrapper: wrapper({ sdkKey: "dummy-key", timeout: 10 }),
    });

    await waitFor(() => expect(result.current.readyStatus).toBe("default"));
    expect(result.current.value).toBe("default-value");
    unmount();
  });

  it("connects to the server with the correct SDK key and metadata", async () => {
    mockFetchWith(async () =>
      buildResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(message(full()));
          },
        }),
      ),
    );

    const { unmount } = renderHook(() => useConfigValue("key", "default"), {
      wrapper: wrapper({ sdkKey: "test-key" }),
    });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.clientSdkKey).toBe("test-key");
    expect(body.metaContext).toMatchObject({ sdkName: "react-native-sdk" });
    unmount();
  });

  it("sends the real package version, not the __VERSION__ sentinel", async () => {
    mockFetchWith(async () => buildResponse(new ReadableStream()));

    const { unmount } = renderHook(() => useConfigValue("key", "default"), {
      wrapper: wrapper({ sdkKey: "test-key" }),
    });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect((body.metaContext as any).sdkVersion).not.toContain("VERSION");
    unmount();
  });

  describe("NetInfo connectivity handling", () => {
    it("reconnects immediately when network is restored after going offline", async () => {
      let connectivityHandler: ((state: { isConnected: boolean | null }) => void) | null = null;
      const netInfoSubscribe = jest.fn((handler: (state: { isConnected: boolean | null }) => void) => {
        connectivityHandler = handler;
        return jest.fn();
      });

      mockFetchWith(async () => buildResponse(new ReadableStream()));

      const { result, unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", timeout: 10, netInfoSubscribe }),
      });

      await waitFor(() => expect(result.current.readyStatus).toBe("default"));
      await waitFor(() => expect(connectivityHandler).not.toBeNull());

      const callsBefore = fetchSpy.mock.calls.length;
      await act(async () => {
        connectivityHandler?.({ isConnected: false });
      });
      await act(async () => {
        connectivityHandler?.({ isConnected: true });
      });

      await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBefore));
      unmount();
    });

    it("does not reconnect when a connected event fires without a prior offline event", async () => {
      let connectivityHandler: ((state: { isConnected: boolean | null }) => void) | null = null;
      const netInfoSubscribe = jest.fn((handler: (state: { isConnected: boolean | null }) => void) => {
        connectivityHandler = handler;
        return jest.fn();
      });

      mockFetchWith(async () => buildResponse(new ReadableStream()));

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", timeout: 10, netInfoSubscribe }),
      });

      await waitFor(() => expect(connectivityHandler).not.toBeNull());
      const callsBefore = fetchSpy.mock.calls.length;

      await act(async () => {
        connectivityHandler?.({ isConnected: true });
      });

      expect(fetchSpy.mock.calls.length).toBe(callsBefore);
      unmount();
    });

    it("does not reconnect when network is restored while the app is in the background", async () => {
      let connectivityHandler: ((state: { isConnected: boolean | null }) => void) | null = null;
      const netInfoSubscribe = jest.fn((handler: (state: { isConnected: boolean | null }) => void) => {
        connectivityHandler = handler;
        return jest.fn();
      });
      const originalCurrentState = AppState.currentState;
      (AppState as any).currentState = "background";

      mockFetchWith(async () => buildResponse(new ReadableStream()));

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", timeout: 10, netInfoSubscribe }),
      });

      await waitFor(() => expect(connectivityHandler).not.toBeNull());
      const callsBefore = fetchSpy.mock.calls.length;

      await act(async () => {
        connectivityHandler?.({ isConnected: false });
      });
      await act(async () => {
        connectivityHandler?.({ isConnected: true });
      });

      expect(fetchSpy.mock.calls.length).toBe(callsBefore);
      (AppState as any).currentState = originalCurrentState;
      unmount();
    });

    it("unsubscribes from NetInfo on unmount", async () => {
      const netInfoUnsubscribe = jest.fn();
      const netInfoSubscribe = jest.fn(() => netInfoUnsubscribe);

      mockFetchWith(async () => buildResponse(new ReadableStream()));

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", timeout: 10, netInfoSubscribe }),
      });

      await waitFor(() => expect(netInfoSubscribe).toHaveBeenCalled());
      act(() => {
        unmount();
      });

      expect(netInfoUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("context prop updates", () => {
    it("calls updateContext and reconnects when the context prop changes", async () => {
      mockFetchWith(async () => buildResponse(new ReadableStream()));

      let setContext: (ctx: { id: string }) => void = () => {};

      const StatefulWrapper = ({ children }: { children: React.ReactNode }) => {
        const [context, setCtx] = React.useState<{ id: string } | undefined>(undefined);
        setContext = setCtx;
        return (
          <ConfigDirectorProvider sdkKey="dummy-key" context={context} logger={logger}>
            {children}
          </ConfigDirectorProvider>
        );
      };

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: StatefulWrapper,
      });

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      const callsBefore = fetchSpy.mock.calls.length;

      await act(async () => {
        setContext({ id: "user-1" });
      });

      await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBefore));
      const sseCalls = (fetchSpy.mock.calls as Array<[unknown, RequestInit]>).filter(([url]) =>
        String(url).includes("/sse/"),
      );
      const body = JSON.parse(sseCalls.at(-1)?.[1].body as string) as Record<string, unknown>;
      expect(body.givenContext).toMatchObject({ id: "user-1" });

      unmount();
    });

    it("does not reconnect when an unrelated prop changes", async () => {
      mockFetchWith(async () => buildResponse(new ReadableStream()));

      let setAppName: (name: string) => void = () => {};

      const StatefulWrapper = ({ children }: { children: React.ReactNode }) => {
        const [appName, setName] = React.useState("v1");
        setAppName = setName;
        return (
          <ConfigDirectorProvider sdkKey="dummy-key" appName={appName} logger={logger}>
            {children}
          </ConfigDirectorProvider>
        );
      };

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: StatefulWrapper,
      });

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      const callsBefore = fetchSpy.mock.calls.length;

      await act(async () => {
        setAppName("v2");
      });

      // No new fetch — only context changes trigger updateContext
      expect(fetchSpy.mock.calls.length).toBe(callsBefore);
      unmount();
    });
  });

  describe("instanceId", () => {
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    it("sends a generated instanceId on the SSE connection", async () => {
      mockFetchWith(async () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message(full()));
            },
          }),
        ),
      );

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "test-key" }),
      });

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.instanceId).toMatch(UUID_PATTERN);
      unmount();
    });

    it("keeps the same instanceId across reconnects triggered by a context change", async () => {
      mockFetchWith(async () => buildResponse(new ReadableStream()));

      let setContext: (ctx: { id: string }) => void = () => {};

      const StatefulWrapper = ({ children }: { children: React.ReactNode }) => {
        const [context, setCtx] = React.useState<{ id: string } | undefined>(undefined);
        setContext = setCtx;
        return (
          <ConfigDirectorProvider sdkKey="dummy-key" context={context} logger={logger}>
            {children}
          </ConfigDirectorProvider>
        );
      };

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: StatefulWrapper,
      });

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      const sseCallsBefore = (fetchSpy.mock.calls as Array<[unknown, RequestInit]>).filter(([url]) =>
        String(url).includes("/sse/"),
      );
      const firstBody = JSON.parse(sseCallsBefore[0]?.[1].body as string) as Record<string, unknown>;

      await act(async () => {
        setContext({ id: "user-1" });
      });

      await waitFor(() => {
        const sseCalls = (fetchSpy.mock.calls as Array<[unknown, RequestInit]>).filter(([url]) =>
          String(url).includes("/sse/"),
        );
        expect(sseCalls.length).toBeGreaterThan(sseCallsBefore.length);
      });

      const sseCallsAfter = (fetchSpy.mock.calls as Array<[unknown, RequestInit]>).filter(([url]) =>
        String(url).includes("/sse/"),
      );
      const lastBody = JSON.parse(sseCallsAfter.at(-1)?.[1].body as string) as Record<string, unknown>;

      expect(firstBody.instanceId).toMatch(UUID_PATTERN);
      expect(lastBody.instanceId).toBe(firstBody.instanceId);

      unmount();
    });
  });

  describe("hooks", () => {
    it("calls the clientReady hook when the client connects", async () => {
      const clientReadyHook = jest.fn();

      mockFetchWith(async () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message(full()));
            },
          }),
        ),
      );

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", hooks: { clientReady: clientReadyHook } }),
      });

      await waitFor(() => expect(clientReadyHook).toHaveBeenCalledTimes(1), { timeout: 1_000 });
      unmount();
    });

    it("calls the configsUpdated hook when configs are received", async () => {
      const configsUpdatedHook = jest.fn();

      mockFetchWith(async () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                message(
                  full({
                    "example-config": {
                      id: "00000000-0000-0000-0000-0000000003e8",
                      key: "example-config",
                      type: "string",
                      value: "Hello",
                    },
                  }),
                ),
              );
            },
          }),
        ),
      );

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", hooks: { configsUpdated: configsUpdatedHook } }),
      });

      await waitFor(
        () => {
          expect(configsUpdatedHook).toHaveBeenCalledTimes(1);
          expect(configsUpdatedHook.mock.calls[0]![0]).toMatchObject({ keys: ["example-config"] });
        },
        { timeout: 1_000 },
      );
      unmount();
    });

    it("calls the contextUpdated hook when context changes", async () => {
      const contextUpdatedHook = jest.fn();

      mockFetchWith(async () => buildResponse(new ReadableStream()));

      let setContext: (ctx: { id: string }) => void = () => {};

      const StatefulWrapper = ({ children }: { children: React.ReactNode }) => {
        const [context, setCtx] = React.useState<{ id: string } | undefined>(undefined);
        setContext = setCtx;
        return (
          <ConfigDirectorProvider
            sdkKey="dummy-key"
            context={context}
            logger={logger}
            hooks={{ contextUpdated: contextUpdatedHook }}>
            {children}
          </ConfigDirectorProvider>
        );
      };

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: StatefulWrapper,
      });

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled(), { timeout: 1_000 });

      await act(async () => {
        setContext({ id: "user-1" });
      });

      await waitFor(
        () => {
          expect(contextUpdatedHook).toHaveBeenCalledWith(
            expect.objectContaining({ context: { id: "user-1" } }),
          );
        },
        { timeout: 1_000 },
      );
      unmount();
    });

    it("calls the configEvaluated hook when a config value is read", async () => {
      const configEvaluatedHook = jest.fn();

      mockFetchWith(async () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                message(
                  full({
                    "example-config": {
                      id: "00000000-0000-0000-0000-0000000003e8",
                      key: "example-config",
                      type: "string",
                      value: "Hello",
                    },
                  }),
                ),
              );
            },
          }),
        ),
      );

      const { result, unmount } = renderHook(() => useConfigValue("example-config", "Default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", hooks: { configEvaluated: configEvaluatedHook } }),
      });

      await waitFor(() => expect(result.current.value).toBe("Hello"), { timeout: 1_000 });

      await waitFor(
        () => {
          expect(configEvaluatedHook).toHaveBeenCalledWith(
            expect.objectContaining({ evaluation: expect.objectContaining({ key: "example-config" }) }),
          );
        },
        { timeout: 1_000 },
      );
      unmount();
    });

    it("accepts an array of handlers for the same hook event", async () => {
      const hook1 = jest.fn();
      const hook2 = jest.fn();

      mockFetchWith(async () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message(full()));
            },
          }),
        ),
      );

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", hooks: { clientReady: [hook1, hook2] } }),
      });

      await waitFor(
        () => {
          expect(hook1).toHaveBeenCalledTimes(1);
          expect(hook2).toHaveBeenCalledTimes(1);
        },
        { timeout: 1_000 },
      );
      unmount();
    });
  });

  describe("AppState handling", () => {
    let appStateHandler: ((state: string) => void) | null = null;
    let mockRemove: ReturnType<typeof jest.fn>;
    let addEventListenerSpy: { mockRestore: () => void };

    beforeEach(() => {
      appStateHandler = null;
      mockRemove = jest.fn();
      addEventListenerSpy = jest.spyOn(AppState, "addEventListener").mockImplementation((event, handler) => {
        if (event === "change") appStateHandler = handler as (state: string) => void;
        return { remove: mockRemove } as any;
      });
    });

    afterEach(() => {
      addEventListenerSpy.mockRestore();
    });

    it("registers an AppState listener after initialization", async () => {
      mockFetchWith(async () => buildResponse(new ReadableStream()));

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", timeout: 10 }),
      });

      await waitFor(() => expect(appStateHandler).not.toBeNull());
      unmount();
    });

    it("reconnects when the app returns to the foreground", async () => {
      mockFetchWith(async () => buildResponse(new ReadableStream()));

      const { result, unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", timeout: 10 }),
      });

      await waitFor(() => expect(result.current.readyStatus).toBe("default"));

      const callsBefore = fetchSpy.mock.calls.length;
      await act(async () => {
        appStateHandler?.("active");
      });

      await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBefore));
      unmount();
    });

    it("preserves the current status while reconnecting — no loading flash", async () => {
      mockFetchWith(async () => buildResponse(new ReadableStream()));

      const { result, unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", timeout: 10 }),
      });

      await waitFor(() => expect(result.current.readyStatus).toBe("default"));
      await act(async () => {
        appStateHandler?.("background");
      });
      await act(async () => {
        appStateHandler?.("active");
      });

      // Status must stay "default" — not flicker to "loading" — during background reconnect
      expect(result.current.readyStatus).toBe("default");
      unmount();
    });

    it("provider updates to 'ready' after resuming from background, proving event handlers survived", async () => {
      const streamControllers: ReadableStreamDefaultController<Uint8Array>[] = [];
      fetchSpy.mockImplementation(async (url) => {
        if ((url as string).includes("telemetry")) return Response.json({}, { status: 204 });
        return buildResponse(
          new ReadableStream({
            start: (ctrl) => {
              streamControllers.push(ctrl);
            },
          }),
        );
      });

      const { result, unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", timeout: 10 }),
      });

      await waitFor(() => expect(result.current.readyStatus).toBe("default"));
      await waitFor(() => expect(appStateHandler).not.toBeNull());

      await act(async () => {
        appStateHandler?.("background");
      });
      await act(async () => {
        appStateHandler?.("active");
      });

      // Wait for the new SSE connection established on resume
      await waitFor(() => expect(streamControllers.length).toBeGreaterThanOrEqual(2));

      // Send a full config set on the resumed stream — clientReady fires only if the
      // event handler registered in componentDidMount was NOT cleared by pauseNetwork
      await act(async () => {
        streamControllers.at(-1)?.enqueue(message(full()));
      });

      await waitFor(() => expect(result.current.readyStatus).toBe("ready"));
      unmount();
    });

    it("removes the AppState subscription on unmount", async () => {
      mockFetchWith(async () => buildResponse(new ReadableStream()));

      const { unmount } = renderHook(() => useConfigValue("key", "default"), {
        wrapper: wrapper({ sdkKey: "dummy-key", timeout: 10 }),
      });

      await waitFor(() => expect(appStateHandler).not.toBeNull());
      act(() => {
        unmount();
      });

      expect(mockRemove).toHaveBeenCalled();
    });
  });
});
