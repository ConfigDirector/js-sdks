import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { commands } from "vitest/browser";
import { render, screen } from "@testing-library/react";
import { ConfigDirectorProvider } from "../src/provider";
import { useConfigValue } from "../src";
import { SSE_URL, createStubbedLogger } from "./helpers";

const logger = createStubbedLogger();

const full = (configs: object = {}) => ({
  environmentId: 100,
  projectId: 200,
  kind: "full",
  configs,
});

describe("useConfigValue", () => {
  beforeAll(async () => {
    await commands.mswSetup();
  });

  afterAll(async () => {
    await commands.mswTeardown();
  });

  it("retrieves the value for the given config key", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          data: full({
            "example-config": { id: 1000, key: "example-config", type: "string", value: "Hello" },
          }),
        },
      ],
    ]);

    const TestComponent = () => {
      const { value } = useConfigValue("example-config", "Default");
      return <div data-testid="target">{value}</div>;
    };

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger}>
        <TestComponent />
      </ConfigDirectorProvider>,
    );

    await screen.findByText("Hello", undefined, { timeout: 1_000 });
  });

  it("returns the default value until the configs are loaded", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          delay: 100,
          data: full({
            "example-config": { id: 1000, key: "example-config", type: "string", value: "Hello" },
          }),
        },
      ],
    ]);

    const TestComponent = () => {
      const { value } = useConfigValue("example-config", "Default");
      return <div data-testid="target">{value}</div>;
    };

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger}>
        <TestComponent />
      </ConfigDirectorProvider>,
    );

    expect(screen.getByTestId("target")).toHaveTextContent("Default");
    await screen.findByText("Hello", undefined, { timeout: 1_000 });
  });

  it("calls updateContext and reconnects when the context prop changes", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          data: full({
            "example-config": {
              id: 1000,
              key: "example-config",
              type: "string",
              value: "before-context-update",
            },
          }),
        },
      ],
      [
        {
          data: full({
            "example-config": {
              id: 1000,
              key: "example-config",
              type: "string",
              value: "after-context-update",
            },
          }),
        },
      ],
    ]);

    const TestComponent = () => {
      const { value } = useConfigValue("example-config", "Default");
      return <div data-testid="target">{value}</div>;
    };

    const { rerender } = render(
      <ConfigDirectorProvider sdkKey="dummy-key" context={{ id: "user-1" }} logger={logger}>
        <TestComponent />
      </ConfigDirectorProvider>,
    );

    await screen.findByText("before-context-update", undefined, { timeout: 1_000 });

    rerender(
      <ConfigDirectorProvider sdkKey="dummy-key" context={{ id: "user-2" }} logger={logger}>
        <TestComponent />
      </ConfigDirectorProvider>,
    );

    await screen.findByText("after-context-update", undefined, { timeout: 1_000 });

    const payloads = await commands.mswGetPayloads();
    expect(payloads).toHaveLength(2);
    expect((payloads[1] as any)?.givenContext).toMatchObject({ id: "user-2" });
  });

  it("is 'loading' until configs are loaded", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          delay: 100,
          data: full({
            "example-config": { id: 1000, key: "example-config", type: "string", value: "Hello" },
          }),
        },
      ],
    ]);

    const TestComponent = () => {
      const { value, loading } = useConfigValue("example-config", "Default");
      return <div data-testid="target">{loading ? "Loading" : value}</div>;
    };

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger}>
        <TestComponent />
      </ConfigDirectorProvider>,
    );

    expect(screen.getByTestId("target")).toHaveTextContent("Loading");
    await screen.findByText("Hello", undefined, { timeout: 1_000 });
  });
});
