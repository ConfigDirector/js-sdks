import { afterAll, beforeAll, describe, test, expect, vi } from "vitest";
import { commands } from "vitest/browser";
import { render, screen } from "@testing-library/react";
import { withProvider } from "../src/withProvider";
import { useClient, useConfigValue } from "../src";
import { SSE_URL, createStubbedLogger } from "./helpers";
import type { ConfigDirectorClient } from "@js-browser-client/index";

const logger = createStubbedLogger();

const full = (configs: object = {}) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "full",
  configs,
});

const handlerCount = (client: ConfigDirectorClient, event: string) =>
  ((client as any).eventEmitter.handlerMap.get(event) ?? []).length;

let capturedClient: ConfigDirectorClient | undefined;

const ClientProbe = () => {
  capturedClient = useClient().client;
  return null;
};

describe("withProvider", () => {
  beforeAll(async () => {
    await commands.mswSetup();
  });

  afterAll(async () => {
    await commands.mswTeardown();
  });

  test("provides an initialized client that serves config values", async () => {
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
    const Provider = await withProvider({ sdkKey: "dummy-key", logger });

    const ValueProbe = () => {
      const { value } = useConfigValue("example-config", "default");
      return <div data-testid="value">{value}</div>;
    };
    render(
      <Provider>
        <ValueProbe />
      </Provider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("value")).toHaveTextContent("Hello");
    });
  });

  test("registers client listeners once across re-renders and removes them on unmount", async () => {
    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);
    const Provider = await withProvider({ sdkKey: "dummy-key", logger });

    const view = render(
      <Provider>
        <ClientProbe />
      </Provider>,
    );
    view.rerender(
      <Provider>
        <ClientProbe />
      </Provider>,
    );
    view.rerender(
      <Provider>
        <ClientProbe />
      </Provider>,
    );

    expect(capturedClient).toBeDefined();
    const client = capturedClient as ConfigDirectorClient;
    expect(handlerCount(client, "configsUpdated")).toBe(1);
    expect(handlerCount(client, "clientReady")).toBe(1);

    view.unmount();

    expect(handlerCount(client, "configsUpdated")).toBe(0);
    expect(handlerCount(client, "clientReady")).toBe(0);
  });
});
