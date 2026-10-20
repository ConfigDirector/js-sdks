import { afterAll, beforeAll, describe, test, expect, vi } from "vitest";
import { commands } from "vitest/browser";
import { cleanup, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { ConfigDirectorProvider } from "../src/provider";
import { useConfigValue } from "../src";
import { createClient } from "../src/client";
import { ConfigDirectorValidationError } from "@shared/errors";
import { POLLING_URL, SSE_URL, TELEMETRY_URL, createStubbedLogger, sleep } from "./helpers";

const logger = createStubbedLogger();

const full = (configs: object = {}) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "full",
  configs,
});

describe("ConfigDirectorProvider hooks", () => {
  beforeAll(async () => {
    await commands.mswSetup();
  });

  afterAll(async () => {
    await commands.mswTeardown();
  });

  test("calls the clientReady hook when the client connects", async () => {
    const clientReadyHook = vi.fn();

    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger} hooks={{ clientReady: clientReadyHook }}>
        <div />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => {
      expect(clientReadyHook).toHaveBeenCalledOnce();
    });
  });

  test("keeps its hooks and serves values when StrictMode remounts the provider", async () => {
    const clientReadyHook = vi.fn();
    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          data: full({
            "example-config": {
              id: "00000000-0000-0000-0000-0000000003e8",
              key: "example-config",
              type: "string",
              value: "Hello",
            },
          }),
        },
      ],
      [
        {
          data: full({
            "example-config": {
              id: "00000000-0000-0000-0000-0000000003e8",
              key: "example-config",
              type: "string",
              value: "Hello",
            },
          }),
        },
      ],
    ]);
    const Value = () => <div data-testid="value">{useConfigValue("example-config", "default").value}</div>;

    render(
      <StrictMode>
        <ConfigDirectorProvider sdkKey="dummy-key" logger={logger} hooks={{ clientReady: clientReadyHook }}>
          <Value />
        </ConfigDirectorProvider>
      </StrictMode>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("value")).toHaveTextContent("Hello");
    });
    expect(clientReadyHook).toHaveBeenCalled();
  });

  test("calls the configsUpdated hook when configs are received", async () => {
    const configsUpdatedHook = vi.fn();

    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          data: full({
            "example-config": {
              id: "00000000-0000-0000-0000-0000000003e8",
              key: "example-config",
              type: "string",
              value: "Hello",
            },
          }),
        },
      ],
    ]);

    render(
      <ConfigDirectorProvider
        sdkKey="dummy-key"
        logger={logger}
        hooks={{ configsUpdated: configsUpdatedHook }}>
        <div />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => {
      expect(configsUpdatedHook).toHaveBeenCalledOnce();
      expect(configsUpdatedHook.mock.calls[0][0]).toMatchObject({ keys: ["example-config"] });
    });
  });

  test("calls the contextUpdated hook when context changes", async () => {
    const contextUpdatedHook = vi.fn();

    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }], [{ data: full() }]]);

    const { rerender } = render(
      <ConfigDirectorProvider
        sdkKey="dummy-key"
        logger={logger}
        context={{ id: "user-1" }}
        hooks={{ contextUpdated: contextUpdatedHook }}>
        <div />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(async () => {
      const payloads = await commands.mswGetPayloads();
      expect(payloads.length).toBeGreaterThanOrEqual(1);
    });

    rerender(
      <ConfigDirectorProvider
        sdkKey="dummy-key"
        logger={logger}
        context={{ id: "user-2" }}
        hooks={{ contextUpdated: contextUpdatedHook }}>
        <div />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => {
      expect(contextUpdatedHook).toHaveBeenCalledWith(expect.objectContaining({ context: { id: "user-2" } }));
    });
  });

  test("calls the configEvaluated hook when a config value is read", async () => {
    const configEvaluatedHook = vi.fn();

    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          data: full({
            "example-config": {
              id: "00000000-0000-0000-0000-0000000003e8",
              key: "example-config",
              type: "string",
              value: "Hello",
            },
          }),
        },
      ],
    ]);

    const TestComponent = () => {
      const { value } = useConfigValue("example-config", "Default");
      return <div data-testid="target">{value}</div>;
    };

    render(
      <ConfigDirectorProvider
        sdkKey="dummy-key"
        logger={logger}
        hooks={{ configEvaluated: configEvaluatedHook }}>
        <TestComponent />
      </ConfigDirectorProvider>,
    );

    await screen.findByText("Hello", undefined, { timeout: 1_000 });

    await vi.waitFor(() => {
      expect(configEvaluatedHook).toHaveBeenCalledWith(
        expect.objectContaining({ evaluation: expect.objectContaining({ key: "example-config" }) }),
      );
    });
  });

  test("accepts an array of handlers for the same hook event", async () => {
    const hook1 = vi.fn();
    const hook2 = vi.fn();

    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger} hooks={{ clientReady: [hook1, hook2] }}>
        <div />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => {
      expect(hook1).toHaveBeenCalledOnce();
      expect(hook2).toHaveBeenCalledOnce();
    });
  });
});

describe("ConfigDirectorProvider in offline mode", () => {
  beforeAll(async () => {
    await commands.mswSetup();
  });

  afterAll(async () => {
    await commands.mswTeardown();
  });

  test("renders the offline value as ready without a key or a request", async () => {
    await commands.mswUseHandlers({ url: SSE_URL }, { url: POLLING_URL }, { url: TELEMETRY_URL });
    const MaxItems = () => {
      const { value, readyStatus } = useConfigValue("max-items", 0);
      return (
        <>
          <div data-testid="status">{readyStatus}</div>
          <div data-testid="max-items">{value}</div>
        </>
      );
    };

    render(
      <ConfigDirectorProvider
        logger={logger}
        appName="offline-app"
        context={{ id: "offline-user-1" }}
        mode="offline"
        values={{ "max-items": 20 }}>
        <MaxItems />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("max-items")).toHaveTextContent("20");
    cleanup();
    await sleep(100);
    expect(JSON.stringify(await commands.mswGetPayloads())).not.toMatch(/offline-(app|user)/);
  });

  test("reports ready again with the same value after the context prop changes", async () => {
    const MaxItems = () => {
      const { value, readyStatus } = useConfigValue("max-items", 0);
      return (
        <>
          <div data-testid="status">{readyStatus}</div>
          <div data-testid="max-items">{value}</div>
        </>
      );
    };
    const view = render(
      <ConfigDirectorProvider logger={logger} mode="offline" values={{ "max-items": 20 }} context={{ id: "user-1" }}>
        <MaxItems />
      </ConfigDirectorProvider>,
    );
    await vi.waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));

    view.rerender(
      <ConfigDirectorProvider logger={logger} mode="offline" values={{ "max-items": 20 }} context={{ id: "user-2" }}>
        <MaxItems />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("max-items")).toHaveTextContent("20");
  });

  test("reports ready when given a ready client and another context", async () => {
    const client = createClient(undefined, { logger, connection: { mode: "offline", values: { "max-items": 20 } } });
    await client.initialize({ id: "user-1" });
    const Status = () => <div data-testid="status">{useConfigValue("max-items", 0).readyStatus}</div>;

    render(
      <ConfigDirectorProvider client={client} context={{ id: "user-2" }}>
        <Status />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(client.context).toEqual({ id: "user-2" }));
    await vi.waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    client.dispose();
  });

  test("fails without a key outside offline mode", () => {
    expect(() =>
      render(
        <ConfigDirectorProvider logger={logger}>
          <div />
        </ConfigDirectorProvider>,
      ),
    ).toThrow(ConfigDirectorValidationError);
  });
});
