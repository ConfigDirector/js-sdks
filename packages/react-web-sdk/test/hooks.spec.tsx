import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
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
              id: "00000000-0000-0000-0000-0000000003e8",
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
              id: "00000000-0000-0000-0000-0000000003e8",
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

  it("returns the parsed object when the server sends a json config and the default is an object", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          data: full({
            "json-config": {
              id: "00000000-0000-0000-0000-000000000001",
              key: "json-config",
              type: "json",
              value: JSON.stringify({ greeting: "hello", count: 3 }),
            },
          }),
        },
      ],
    ]);

    const TestComponent = () => {
      const { value } = useConfigValue("json-config", { greeting: "default", count: 0 });
      return <div data-testid="target">{JSON.stringify(value)}</div>;
    };

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger}>
        <TestComponent />
      </ConfigDirectorProvider>,
    );

    await screen.findByText(JSON.stringify({ greeting: "hello", count: 3 }), undefined, { timeout: 1_000 });
  });

  it("returns the default object when the json config key is not present in the server response", async () => {
    await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

    const TestComponent = () => {
      const { value } = useConfigValue("json-config", { greeting: "default" });
      return <div data-testid="target">{JSON.stringify(value)}</div>;
    };

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger}>
        <TestComponent />
      </ConfigDirectorProvider>,
    );

    await screen.findByText(JSON.stringify({ greeting: "default" }), undefined, { timeout: 1_000 });
  });

  it("returns the raw json string when the default value type is string", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          data: full({
            "json-config": {
              id: "00000000-0000-0000-0000-000000000001",
              key: "json-config",
              type: "json",
              value: JSON.stringify({ greeting: "hello" }),
            },
          }),
        },
      ],
    ]);

    const TestComponent = () => {
      const { value } = useConfigValue("json-config", "{}");
      return <div data-testid="target">{value}</div>;
    };

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger}>
        <TestComponent />
      </ConfigDirectorProvider>,
    );

    await screen.findByText(JSON.stringify({ greeting: "hello" }), undefined, { timeout: 1_000 });
  });

  describe("instanceId", () => {
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    it("sends a generated instanceId on the SSE connection", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

      render(
        <ConfigDirectorProvider sdkKey="dummy-key" logger={logger}>
          <div />
        </ConfigDirectorProvider>,
      );

      await vi.waitFor(async () => {
        const payloads = await commands.mswGetPayloads();
        expect((payloads[0] as any)?.instanceId).toMatch(UUID_PATTERN);
      });
    });

    it("keeps the same instanceId across reconnects triggered by a context change", async () => {
      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }], [{ data: full() }]]);

      const { rerender } = render(
        <ConfigDirectorProvider sdkKey="dummy-key" context={{ id: "user-1" }} logger={logger}>
          <div />
        </ConfigDirectorProvider>,
      );

      await vi.waitFor(async () => {
        const payloads = await commands.mswGetPayloads();
        expect(payloads).toHaveLength(1);
      });

      rerender(
        <ConfigDirectorProvider sdkKey="dummy-key" context={{ id: "user-2" }} logger={logger}>
          <div />
        </ConfigDirectorProvider>,
      );

      await vi.waitFor(async () => {
        const payloads = await commands.mswGetPayloads();
        expect(payloads).toHaveLength(2);
      });

      const payloads = await commands.mswGetPayloads();
      expect((payloads[0] as any)?.instanceId).toMatch(UUID_PATTERN);
      expect((payloads[1] as any)?.instanceId).toBe((payloads[0] as any)?.instanceId);
    });
  });

  it("is 'loading' until configs are loaded", async () => {
    await commands.mswUseSseHandler(SSE_URL, [
      [
        {
          delay: 100,
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
