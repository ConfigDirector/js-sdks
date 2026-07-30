import { afterAll, beforeAll, describe, test, expect, vi } from "vitest";
import { commands } from "vitest/browser";
import { render, screen } from "@testing-library/react";
import { ConfigDirectorProvider } from "../src/provider";
import { useConfigValue } from "../src";
import { SSE_URL, createStubbedLogger } from "./helpers";

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
